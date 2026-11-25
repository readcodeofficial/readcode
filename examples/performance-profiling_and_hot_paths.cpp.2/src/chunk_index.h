#pragma once

#include <xxhash.h>

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_set>
#include <vector>

namespace sync {

struct ChunkRef {
  uint64_t hash;
  uint64_t offset;
  uint32_t length;
};

struct Scratch {
  explicit Scratch(size_t bytes) : block(bytes) {}
  std::vector<char> block;
};

class ChunkIndexer {
 public:
  ChunkIndexer(size_t chunk_size, size_t chunks_per_block)
      : chunk_size_(chunk_size), block_bytes_(chunk_size * chunks_per_block) {
    if (chunk_size == 0 || chunks_per_block == 0 ||
        chunk_size > std::numeric_limits<uint32_t>::max()) {
      throw std::invalid_argument("invalid chunking parameters");
    }
  }

  size_t block_bytes() const { return block_bytes_; }

  void split(std::string_view data, uint64_t base_offset,
             std::vector<ChunkRef>& out) const {
    for (size_t off = 0; off < data.size(); off += chunk_size_) {
      const size_t len = std::min(chunk_size_, data.size() - off);
      out.push_back(ChunkRef{XXH3_64bits(data.data() + off, len),
                             base_offset + off, static_cast<uint32_t>(len)});
    }
  }

  std::vector<ChunkRef> index_file(const std::filesystem::path& path,
                                   Scratch& scratch) const {
    std::ifstream in(path, std::ios::binary);
    if (!in) {
      throw std::runtime_error("cannot open " + path.string());
    }

    std::vector<ChunkRef> refs;
    refs.reserve(std::filesystem::file_size(path) / chunk_size_ + 1);

    uint64_t offset = 0;
    while (in) {
      in.read(scratch.block.data(),
              static_cast<std::streamsize>(scratch.block.size()));
      const auto got = static_cast<size_t>(in.gcount());
      if (got == 0) break;
      split(std::string_view(scratch.block.data(), got), offset, refs);
      offset += got;
    }
    if (in.bad()) {
      throw std::runtime_error("read error on " + path.string());
    }
    return refs;
  }

 private:
  size_t chunk_size_;
  size_t block_bytes_;
};

inline std::vector<size_t> chunks_to_upload(
    const std::vector<ChunkRef>& refs,
    const std::unordered_set<uint64_t>& already_remote) {
  std::vector<size_t> missing;
  std::unordered_set<uint64_t> queued;
  queued.reserve(refs.size());
  for (size_t i = 0; i < refs.size(); ++i) {
    const uint64_t h = refs[i].hash;
    if (already_remote.contains(h)) continue;
    if (queued.insert(h).second) missing.push_back(i);
  }
  return missing;
}

}  // namespace sync
