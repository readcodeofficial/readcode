#include <benchmark/benchmark.h>

#include <cstdint>
#include <random>
#include <string>
#include <unordered_set>
#include <vector>

#include "chunk_index.h"

namespace {

std::string make_payload(size_t bytes) {
  std::mt19937_64 rng(42);
  std::string data(bytes, '\0');
  for (size_t i = 0; i + sizeof(uint64_t) <= data.size(); i += sizeof(uint64_t)) {
    const uint64_t v = rng();
    data.replace(i, sizeof(v), reinterpret_cast<const char*>(&v), sizeof(v));
  }
  return data;
}

void BM_Split(benchmark::State& state) {
  const auto chunk = static_cast<size_t>(state.range(0));
  const std::string data = make_payload(64u << 20);
  sync::ChunkIndexer indexer(chunk, 1);

  std::vector<sync::ChunkRef> out;
  out.reserve(data.size() / chunk);
  for (auto _ : state) {
    out.clear();
    indexer.split(data, 0, out);
    benchmark::DoNotOptimize(out.data());
    benchmark::ClobberMemory();
  }
  state.SetBytesProcessed(static_cast<int64_t>(state.iterations()) *
                          static_cast<int64_t>(data.size()));
}
BENCHMARK(BM_Split)->Arg(4 << 10)->Arg(64 << 10)->Arg(1 << 20);

void BM_ChunksToUpload(benchmark::State& state) {
  const std::string data = make_payload(256u << 20);
  sync::ChunkIndexer indexer(4 << 10, 1);
  std::vector<sync::ChunkRef> refs;
  indexer.split(data, 0, refs);

  std::unordered_set<uint64_t> remote;
  remote.reserve(refs.size());
  for (size_t i = 0; i < refs.size(); i += 2) remote.insert(refs[i].hash);

  for (auto _ : state) {
    auto missing = sync::chunks_to_upload(refs, remote);
    benchmark::DoNotOptimize(missing.data());
  }
  state.SetItemsProcessed(static_cast<int64_t>(state.iterations()) *
                          static_cast<int64_t>(refs.size()));
}
BENCHMARK(BM_ChunksToUpload);

}  // namespace

BENCHMARK_MAIN();
