// Server-only: run a fix question's tests. The runner itself lives in shared/runTests.ts so the pipeline can
// verify exercises with exactly the same code (TypeScript/JavaScript, Python, Go, Java).
export { RUNNABLE_LANGUAGES, runTests } from "../../shared/runTests";
