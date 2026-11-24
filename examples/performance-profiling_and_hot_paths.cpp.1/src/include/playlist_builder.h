#pragma once

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace vstream {

struct Segment {
    std::uint32_t sequence;
    double duration_s;
    std::string uri;
};

// Segments must be sorted by ascending, unique sequence number.
class PlaylistBuilder {
public:
    explicit PlaylistBuilder(std::vector<Segment> segments) : segments_(std::move(segments)) {}

    std::string render(std::uint32_t from_sequence, std::size_t window) const {
        auto first = std::lower_bound(
            segments_.begin(), segments_.end(), from_sequence,
            [](const Segment& s, std::uint32_t seq) { return s.sequence < seq; });
        auto last = first + static_cast<std::ptrdiff_t>(
            std::min<std::size_t>(window, static_cast<std::size_t>(segments_.end() - first)));

        double longest = 0.0;
        std::size_t estimate = 96;
        for (auto it = first; it != last; ++it) {
            longest = std::max(longest, it->duration_s);
            estimate += it->uri.size() + 32;
        }

        std::string out;
        out.reserve(estimate);
        out += "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:";
        out += std::to_string(static_cast<int>(std::ceil(longest)));
        out += "\n#EXT-X-MEDIA-SEQUENCE:";
        out += std::to_string(first == last ? from_sequence : first->sequence);
        out += '\n';

        char buf[32];
        for (auto it = first; it != last; ++it) {
            auto res = std::to_chars(buf, buf + sizeof(buf), it->duration_s, std::chars_format::fixed, 3);
            out += "#EXTINF:";
            out.append(buf, res.ptr);
            out += ",\n";
            out += it->uri;
            out += '\n';
        }
        return out;
    }

private:
    std::vector<Segment> segments_;
};

}  // namespace vstream
