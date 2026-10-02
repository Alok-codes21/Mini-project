# Interactive Matrix & Number System Learning Backend

A Node.js + Express backend for a mathematical learning visualizer. This version has exactly two modules: **Matrix** and **Number System**. It does not include a frontend, database, login, set operations or relation analysis.

The algorithms are handwritten JavaScript. Express handles HTTP only; no mathematical library is used.

## Start on Windows, macOS or Linux

1. Install Node.js 22 or newer (npm is included).
2. Clone the repository and open a terminal in its folder:

```text
git clone https://github.com/Alok-codes21/Mini-project.git
cd Mini-project
```

3. Run:

```text
npm ci
npm test
npm start
```

The server runs at `http://localhost:3000`. Open `http://localhost:3000/api` to list the routes, or `http://localhost:3000/health` to check the server.

For automatic restart while editing:

```text
npm run dev
```

No database, API key or paid service is required. An internet connection is needed for the initial npm dependency download.

### Environment settings

Copy `.env.example` to `.env`; the server loads it automatically at startup. Real environment variables (for example on a hosting platform) override `.env`. Invalid values stop the server at startup with a clear message. Never commit `.env`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `production` or `test` |
| `PORT` | `3000` | Integer 1 to 65535 |
| `CORS_ORIGIN` | empty | Comma-separated exact origins allowed in browsers, such as `https://app.example.com,http://localhost:5173`. Empty: development allows any `localhost` origin, production allows no browser origins. `*` is rejected in production. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window in milliseconds |
| `RATE_LIMIT_MAX` | `120` | Requests per client IP per window on `/api` routes |
| `TRUST_PROXY` | `0` | Reverse-proxy hops to trust so rate limits use the real client IP. Set `1` behind one proxy such as Render. With `NODE_ENV=production` and `TRUST_PROXY` unset, the server logs a startup warning, because every client behind the proxy would share one IP and one rate-limit bucket. |
| `LOG_REQUESTS` | `true` | One JSON log line per request (method, path, status, time, request id). Request bodies are never logged. |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Time allowed for in-flight requests on SIGTERM/SIGINT |

PowerShell:

```powershell
$env:CORS_ORIGIN = "http://localhost:5173"
npm start
```

Bash:

```bash
CORS_ORIGIN=http://localhost:5173 npm start
```

## Endpoints

Send JSON with `Content-Type: application/json`. Matrices are arrays of rows. Number-system values must be strings to preserve large integers and leading zeros.

| Method | Route | Body | Learning level |
| --- | --- | --- | --- |
| GET | `/health` | None | Server check |
| GET | `/api` | None | Route discovery and limits |
| GET | `/api/openapi.json` | None | OpenAPI 3 description of the API |
| POST | `/api/matrix/add` | `{ "A": [[1,2],[3,4]], "B": [[5,6],[7,8]] }` | Beginner |
| POST | `/api/matrix/subtract` | Same as addition | Beginner |
| POST | `/api/matrix/transpose` | `{ "A": [[1,2,3],[4,5,6]] }` | Beginner |
| POST | `/api/matrix/multiply` | `{ "A": [[1,2],[3,4]], "B": [[5,6],[7,8]] }` | Intermediate |
| POST | `/api/matrix/determinant` | `{ "A": [[1,2],[3,4]] }` | Advanced |
| POST | `/api/number-system/convert` | `{ "number": "13", "fromBase": 10, "toBase": 2 }` | Beginner; non-decimal to non-decimal is intermediate |
| POST | `/api/practice/check` | `{ "operation": "multiply", "input": { "A": [[1,2],[3,4]], "B": [[5,6],[7,8]] }, "answer": [[19,22],[43,49]] }` | Practice helper (optional) |

### Choosing how many steps: `?detail=`

All matrix and number-system routes accept an optional query parameter `detail`:

| Value | What you get |
| --- | --- |
| `full` (default) | Every step. Same as not sending the parameter; nothing changes for existing clients. |
| `compact` | Fewer steps: setup, one step per result cell (matrices), one per digit read and one per remainder (number conversion), one per cofactor term and minor result (determinants), and the final steps. Same `result`. Step ids stay sequential. |
| `beginner` | The full trace plus one leading `before-you-start` step that explains matrices (rows, columns, entries) or place value. |

Any other value (including an empty or repeated one) returns `400 INVALID_INPUT` with `error.field` set to `detail`. Every matrix and number-system response has a top-level `detail` field with the mode used: `full` (the default when the parameter is omitted), `compact` or `beginner`. For `compact` and `beginner`, `summary.detail` also echoes the choice. An 8 x 8 multiplication drops from 1,156 steps to 68 with `compact`.

Responses are gzip-compressed when the client sends `Accept-Encoding: gzip` (browsers and `fetch` do this automatically).

### Practice check: `POST /api/practice/check`

Body: `operation` (`add`, `subtract`, `transpose`, `multiply`, `determinant` or `convert`), `input` (the same body as that operation's own endpoint), `answer` (a matrix for the matrix operations, a number for `determinant`, a string for `convert`) and optional `reveal` (`true` adds the correct answer as `expected`).

```json
{
  "success": true,
  "schemaVersion": "1.0",
  "module": "matrix",
  "operation": "multiply",
  "correct": false,
  "totalSteps": 22,
  "firstWrongStep": {
    "id": 22, "stage": "calculate", "action": "select-row-column",
    "title": "Select row 2 and column 2",
    "highlights": [{ "matrix": "C", "row": 1, "column": 1 }],
    "reason": "cell-mismatch", "confidence": "medium",
    "hint": "This is the first result cell (in calculation order) that does not match. Redo its calculation from here."
  }
}
```

`firstWrongStep` has only `id`, `stage`, `action`, `title`, `highlights`, `reason`, `confidence` and `hint`. It has no `explanation`, because that text can state the correct result. A learner can fetch the full step text from the normal endpoint (for example `POST /api/matrix/multiply`) and look up the step with the returned `id`. That id is a step id in the full trace of the same question, so a frontend can jump to it. The step is a best guess, and `confidence` says how good: `high` for wrong dimensions, a running total that stopped early, a reversed digit order or an invalid digit; `medium` for a mismatching cell or a sign or skipped-term pattern; `low` when nothing recognizable fits and the first step to re-check is returned. Matrix cells are compared in the order the trace calculates them; numbers within a relative `1e-9` count as equal; conversion answers ignore case and leading zeros. Invalid `operation`, `input` or `answer` return `400 INVALID_INPUT` with the offending `field`.

Learning levels are labels for ordering lessons, not a locked progression or user-account system. The backend is stateless.

## Try a question

In PowerShell:

```powershell
$body = @{ A = @(@(1,2), @(3,4)); B = @(@(5,6), @(7,8)) } | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod -Uri http://localhost:3000/api/matrix/multiply -Method Post -ContentType "application/json" -Body $body
$response.result
$response.steps | Format-List id,title,explanation,formula,keyPoints
```

For conversion:

```powershell
$body = '{"number":"13","fromBase":10,"toBase":2}'
$response = Invoke-RestMethod -Uri http://localhost:3000/api/number-system/convert -Method Post -ContentType "application/json" -Body $body
$response.result
$response.steps | Format-List id,title,explanation,formula,keyPoints
```

On Bash, or in Windows with `curl.exe` and a request JSON file:

```bash
curl -X POST http://localhost:3000/api/matrix/multiply \
  -H 'Content-Type: application/json' \
  --data-binary @examples/multiply-request.json
```

`examples/requests.http` contains all endpoints for an HTTP client extension. `examples/multiply-response.json` and `examples/decimal-to-binary-response.json` contain complete, generated example responses.

## Complete example: matrix multiplication

The API returns both the final `result` and the step-by-step `steps` trace that a frontend can animate. Request:

```bash
curl -X POST http://localhost:3000/api/matrix/multiply \
  -H "Content-Type: application/json" \
  -d '{"A": [[1,2],[3,4]], "B": [[5,6],[7,8]]}'
```

Shortened response (the real one has 28 steps; see `examples/multiply-response.json` for the full output):

```json
{
  "success": true,
  "schemaVersion": "1.0",
  "module": "matrix",
  "operation": "multiply",
  "level": "intermediate",
  "input": { "A": [[1,2],[3,4]], "B": [[5,6],[7,8]] },
  "result": [[19,22],[43,50]],
  "steps": [
    {
      "id": 1, "stage": "understand", "action": "inspect-dimensions",
      "title": "Read the matrix dimensions",
      "explanation": "A has 2 rows and 2 columns; B has 2 rows and 2 columns. ...",
      "formula": "dimensions = number of rows x number of columns",
      "keyPoints": ["The number of columns in A must equal the number of rows in B.", "..."],
      "state": { "A": [[1,2],[3,4]], "B": [[5,6],[7,8]] },
      "highlights": []
    }
  ],
  "summary": { "totalSteps": 28, "keyPoints": ["..."] }
}
```

The answer is `result`. Each entry in `steps` explains one small move (select a row and column, multiply a pair, add to the running sum, store a cell) with the state at that moment.

### Learner-facing text: 1-based, machine data: 0-based

Explanations count from 1 ("row 1, column 2") while `formula`, `state` and `highlights` use JavaScript's 0-based indices (`A[0][1]`). Steps whose formula contains concrete indices also carry an optional `displayFormula` with the 1-based numbers (`A[1][2]`); show that one to learners. Nothing in `formula`, `state` or `highlights` changed. The last entry of every step's `keyPoints` is a `Why: ...` line.

## Response contract

Every successful calculation returns:

```json
{
  "success": true,
  "schemaVersion": "1.0",
  "module": "matrix",
  "operation": "multiply",
  "level": "intermediate",
  "input": { "A": [[1,2],[3,4]], "B": [[5,6],[7,8]] },
  "result": [[19,22],[43,50]],
  "steps": [],
  "summary": { "totalSteps": 0, "keyPoints": [] }
}
```

The empty `steps` above is only a shortened schema illustration. Actual calculation responses include all steps. Each step contains:

| Field | Meaning |
| --- | --- |
| `id` | Consecutive step number starting at 1 |
| `stage` | Phase such as `understand`, `validate`, `calculate`, `decode`, `encode`, `verify`, `complete` |
| `action` | Stable action name for selecting animations |
| `title` | Short English heading |
| `explanation` | Plain English explanation of what happened and why |
| `formula` | The formula needed for this particular step |
| `keyPoints` | Learning reminders to show next to the explanation |
| `state` | A snapshot of the values at this exact step, not the final state retroactively |
| `highlights` | Matrix cells or digit positions to highlight; can be empty |

Matrix highlight objects use `{ "matrix": "A", "row": 0, "column": 0 }`. Digit highlights use `{ "digitIndex": 0 }`. All machine-readable indices start at 0; all row/column numbers in explanations start at 1.

Uncalculated result-matrix cells are `null`, not `0`. The final result has no uncalculated cells.

Number-system numeric intermediates are decimal strings because exact integers can exceed JavaScript's safe-number range. `digitValue`, positions and bases are small JSON numbers. BigInt values never go directly into JSON.

### Frontend next/previous step integration

1. Send the question to the endpoint once.
2. Keep the returned response and initialize `stepIndex = 0`.
3. Render `response.steps[stepIndex].state` in the table or animation area.
4. Show `explanation`, `formula` and `keyPoints` together, side by side.
5. Next increments the index by exactly 1; Previous decrements it by exactly 1. Clamp to `0..steps.length-1`.
6. On a new question, replace the response and reset the index.

The state snapshots let users go backward without recomputing anything. The API provides the content and highlight coordinates; the frontend owns layout, play/pause timing and rendering. Display the intermediate `state.result`, not the top-level final `result`, while stepping through a matrix calculation.

## How the algorithms teach

### Matrix multiplication

For `A = [[1,2],[3,4]]` and `B = [[5,6],[7,8]]`:

- Read dimensions and check that columns(A) equals rows(B).
- Create a 2 x 2 result matrix with uncalculated cells.
- Select A's first row and B's first column.
- Multiply `1 * 5 = 5` in one step.
- Add `0 + 5 = 5` in a separate step.
- Multiply `2 * 7 = 14` in one step.
- Add `5 + 14 = 19` in a separate step.
- Store `19` in the first result cell in a separate step.
- Repeat the entire process for every remaining cell. Later cells are not shortened into an unexplained sum.

The final result is `[[19,22],[43,50]]`.

### Determinants

Use recursive cofactor expansion along the first row. Each entry receives its alternating sign. The backend shows how the minor is formed, recursively calculates the minor determinant, applies the sign, multiplies the term and adds it to the parent running total. A 1 x 1 determinant is the base case. Recursion state includes a unique `label` and `depth`, so a frontend can show which matrix is being explained.

### Decimal 13 to binary

The backend first explains the input by place value. It then shows each whole-number quotient, quotient-times-base product, remainder, and the decision to continue with the quotient:

| Current value | Whole quotient after dividing by 2 | Remainder |
| --- | --- | --- |
| 13 | 6 | 1 |
| 6 | 3 | 0 |
| 3 | 1 | 1 |
| 1 | 0 | 1 |

The recorded remainders are `1,0,1,1`. They go from the smallest place to the largest place. Read them from bottom to top, or reverse the recorded order, to obtain `1101`.

The verification phase explains each output digit separately: `1*2^3`, `1*2^2`, `0*2^1`, `1*2^0`, with contribution and running-total steps. The resulting `8+4+0+1=13` matches the original value.

### Other base conversions

All 16 source-target combinations among binary (2), octal (8), decimal (10), and hexadecimal (16) are supported. A non-decimal source is decoded by place value, then encoded in the target base. The output is verified by place value again. The same-base case is supported and normalizes leading zeros and hex letter case.

## Validation and deliberate limits

- Matrices: rectangular, non-empty, at most 8 rows and 8 columns.
- Matrix entries: finite JSON numbers with absolute value at most 1,000,000. Strings, `null` and missing entries are rejected.
- Add/subtract: same dimensions. Multiply: columns(A) must equal rows(B).
- Determinants: square, at most 4 x 4, to keep recursive educational traces manageable.
- Matrix arithmetic uses JavaScript numbers. Every computed value is rounded to 15 significant digits to clean binary floating-point noise (0.1 + 0.2 shows as 0.3). Integers are never rounded. When rounding actually changes a value, the response adds `summary.notes` with a message saying so; otherwise `summary.notes` is absent. If any intermediate or final value would exceed 9,007,199,254,740,991 in absolute value, the API returns 422 `RESULT_TOO_LARGE` instead of an inexact number. `error.field` is `result` for computed values (the usual case, because inputs are limited to 1,000,000 and a product, sum or determinant is what grows), or `A` / `B` when an input itself is the cause. Decimal inputs are still approximate to about 15 digits. This is an educational API, not an exact rational algebra system.
- Number systems: 1 to 64 source digits, optionally prefixed by `-`; integer values only. No `+`, whitespace, `0x`/`0b` prefixes, fractions or exponent notation.
- Hex letters are case-insensitive on input and uppercase on output. Leading zeros are removed; `-0` becomes `0`.
- Negative results use a minus sign, not two's-complement encoding.
- Number conversions use BigInt and remain exact within the accepted input limits.
- Request JSON body limit: 64 KB (gzip bodies are accepted; the limit applies after decompression). The app has no stored history or authentication.
- Worst-case response sizes, measured with this version (integer entries; decimal entries produce longer numbers). The server compresses with gzip when asked; the gzip column is what travels over the network for a client that accepts it.

| Request | Steps (full) | JSON (full) | gzip (full) | Steps (compact) | JSON (compact) |
| --- | --- | --- | --- | --- | --- |
| Multiply 8 x 8, entries near 1,000,000 | 1,156 | 1.4 MB | 57 KB | 68 | 89 KB |
| Multiply 8 x 8, entries near 1,000 | 1,156 | 1.2 MB | 53 KB | 68 | 75 KB |
| Add 8 x 8 | 196 | 162 KB | 5 KB | 68 | 58 KB |
| Transpose 8 x 8 | 132 | 104 KB | 4 KB | 68 | 55 KB |
| Determinant 4 x 4 | 285 | 132 KB | 8 KB | 84 | 38 KB |
| Convert 64 hex digits to binary (largest) | 2,313 | 1.7 MB | 81 KB | 581 | 559 KB |
| Convert 64 decimal digits to binary | 1,969 | 1.4 MB | 60 KB | 495 | 425 KB |

Request bodies stay limited to 64 KB and `/api` stays rate limited. Frontends that only need the answer or a short walk-through should send `?detail=compact`.

### Errors

Every error has the same shape. `field` appears for input problems; `requestId` matches the `X-Request-Id` response header and the server log line.

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "The number of columns in A must equal the number of rows in B.",
    "field": "B",
    "requestId": "3f0c2c1e-5b52-4a5f-9a43-0c9d6e2f4c11"
  }
}
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Missing, wrong-type or out-of-range input, incompatible dimensions |
| 400 | `INVALID_JSON` | Malformed JSON |
| 400 | `BAD_REQUEST` | Unreadable or corrupt request body |
| 404 | `NOT_FOUND` | Unknown route |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method; the `Allow` header lists the right one |
| 413 | `BODY_TOO_LARGE` | Body over 64 KB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` / `UNSUPPORTED_ENCODING` | Body is not JSON, or uses an unsupported encoding or charset |
| 422 | `RESULT_TOO_LARGE` | An intermediate or final number would exceed JavaScript's exact integer range (9,007,199,254,740,991) |
| 429 | `RATE_LIMITED` | Too many requests; see `Retry-After` |
| 500 | `INTERNAL_ERROR` | Unexpected failure; details go to the server log only, never to the client |

## Security and rate limiting

- `helmet` sets standard security headers; `X-Powered-By` is removed; responses are `Cache-Control: no-store`.
- Rate limit: by default 120 requests per minute per client IP on `/api` routes. `/health` and CORS preflight requests are not counted. Limit headers (`RateLimit`, `RateLimit-Policy`, `Retry-After`) are sent. Behind a proxy set `TRUST_PROXY`, otherwise all users share the proxy's IP.
- The rate limiter is in-memory. Each running instance keeps its own counters, and they reset on restart. With N instances behind a load balancer a client can make up to N times the configured limit. When you scale to more than one instance, use a shared store such as Redis (for example `rate-limit-redis` with `express-rate-limit`) so all instances count together.
- Behind a proxy (Render, Railway, Nginx) set `TRUST_PROXY=1`. Otherwise every client appears to come from the proxy's IP and all of them share one bucket. In production the server warns at startup when `TRUST_PROXY` is not set.
- CORS only echoes origins you list in `CORS_ORIGIN`. CORS controls browser access only. It is not authentication.
- There is no authentication and no HTTPS inside the app. Deploy behind a platform or reverse proxy that terminates HTTPS.

## Folder structure

```text
src/
  app.js                      Express application and error handling
  server.js                   Server startup and shutdown
  config.js                   Environment loading and validation
  common.js                   Input errors, trace snapshots and response builder
  algorithms/
    matrix.js                 Matrix validation and custom algorithms
    number-system.js          Exact base conversion and educational verification
 test/
  algorithms.test.js          Algorithm, validation and step-contract tests
  hardening.test.js           Edge cases, trace integrity, number conversion, config
  api.test.js                 Live HTTP integration tests (errors, CORS, rate limit, headers)
docs/
  openapi.json                OpenAPI 3 description
.github/workflows/ci.yml      GitHub Actions: npm ci, npm test, npm audit
 examples/
  requests.http               Ready-to-use HTTP requests
  *-request.json              Example input bodies
  *-response.json             Full generated learning traces
package.json
package-lock.json
.env.example
.gitignore
README.md
```

## Tests and readiness

Run `npm test` (Node's built-in test runner; no extra test dependency). No linter is configured. The suite covers:

- All five matrix operations, rectangular and boundary-size (8 x 8) matrices, singular determinants, determinants from 1 x 1 to 4 x 4, decimal cleanup, negative zero and refusal of results too large to show exactly.
- Trace integrity: sequential ids, required fields, `summary.totalSteps`, valid highlight positions, snapshot states that later steps or callers cannot change, `null` (not 0) for uncalculated cells.
- All 16 base combinations across 200 integers, 64-digit inputs and random 200-bit values checked against BigInt, and strict number-format rejection (prefixes, signs, spaces, fractions, exponents, bad digits, bad bases).
- Live HTTP: response contract, error shape for every status, malformed JSON, wrong content type, unsupported and corrupt encoding, body limits, 404/405, security headers, request ids, CORS (configured, development and production defaults, preflight), rate limiting.
- Environment validation (ports, rate limits, production CORS) and the production `TRUST_PROXY` warning.
- `?detail=` levels, gzip, rounding notes, error fields, 1-based `displayFormula`, `Why:` lines, the practice endpoint, `render.yaml` and the CI workflow (`test/improvements.test.js`), plus the practice answer-leak and `detail` echo checks (`test/round3.test.js`).

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci` and `npm test` on Node 22 for every push and pull request.

## Deploying on Render

`render.yaml` is a Render Blueprint: in Render choose New > Blueprint and select this repository. It sets `NODE_VERSION=22`, `NODE_ENV=production`, `TRUST_PROXY=1`, the health check path `/health`, `npm ci` as the build command and `npm start` as the start command. Set `CORS_ORIGIN` (exact frontend origins, comma separated) in the Render dashboard; production allows no browser origins until you do. Other platforms need the same environment variables.

## Before a public deployment

This is a stateless educational service, not a hardened production system. Deploy behind HTTPS, set `NODE_ENV=production`, `CORS_ORIGIN`, and `TRUST_PROXY`, and review rate limits for your traffic. Add authentication only if you need to restrict access.

## Colour output

- Terminal: `npm run explain -- multiply '{"A":[[1,2],[3,4]],"B":[[5,6],[7,8]]}'` or `node src/cli.js convert '{"number":"13","fromBase":10,"toBase":2}'`. Gold answer, grey labels, bold white text, one accent colour per module. Plain text when piped or when `NO_COLOR` is set; `--color` forces colour.
- API: add `?style=hints` to any matrix or convert route. The response gets a `style` object (module accent hex, palette, roles) and a `styleRole` on each step. Off by default.
