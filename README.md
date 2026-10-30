# docker-echo-ip

A lightweight, self-hosted public IP detection service built with Node.js.

The service provides two HTTP endpoints for retrieving the public IP address of the requesting client:

- `/myip` — returns the detected IP address as plain text.
- `/json` — returns a structured JSON response with detection status, IP address, and proxy header information.

It supports optional static Bearer token authentication and reverse-proxy IP detection.

**No npm dependencies required.** Uses only Node.js built-in modules.

# docker-echo-ip

A lightweight, self-hosted public IP detection service built with Node.js.

The service provides two HTTP endpoints for retrieving the public IP address of the requesting client:

- `/myip` — returns the detected IP address as plain text.
- `/json` — returns a structured JSON response with detection status, IP address, and proxy header information.

It supports optional static Bearer token authentication and reverse-proxy IP detection.

**No npm dependencies required.** Uses only Node.js built-in modules.

## TL;DR

### Quick start with Docker

Pull the latest image:

```bash
docker pull ghcr.io/xyhtac/docker-echo-ip:latest
```

Generate an API token if authentication is required:

```bash
openssl rand -hex 32
```

Run the container with authentication enabled:

```bash
docker run -d \
  --name docker-echo-ip \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e API_TOKEN="YOUR_SECRET_TOKEN" \
  -e PORT=8080 \
  -e TRUST_PROXY=true \
  ghcr.io/xyhtac/docker-echo-ip:latest
```

To allow anonymous requests, simply omit `API_TOKEN`:

```bash
docker run -d \
  --name docker-echo-ip \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e PORT=8080 \
  -e TRUST_PROXY=true \
  ghcr.io/xyhtac/docker-echo-ip:latest
```

Configure your HTTPS reverse proxy to forward requests to `127.0.0.1:8080`, setting `X-Real-IP` to the actual client address.

Test the plain-text endpoint:

```bash
curl -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  https://ip.example.com/myip
```

Test the JSON endpoint:

```bash
curl -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  https://ip.example.com/json
```

If authentication is disabled, omit the Authorization header.



## Features

- Public IPv4 and IPv6 address detection.
- Plain-text and JSON response formats.
- Optional static Bearer token authorization.
- Optional reverse-proxy support through `X-Real-IP`.
- Configurable listening address and port.
- No external Node.js dependencies.
- Lightweight Docker deployment.

## API

Both endpoints accept unauthenticated requests when `API_TOKEN` is not configured.

When `API_TOKEN` is configured, all requests must include:

```http
Authorization: Bearer YOUR_SECRET_TOKEN
```

### GET `/myip`

Returns the detected client IP address as plain text.

**Successful response:**

HTTP `200 OK`

```text
203.0.113.25
```

If IP detection fails, the endpoint returns HTTP `400 Bad Request`.

```text
Unable to determine client IP
```

### GET `/json`

Returns a structured JSON response.

**Successful response:**

HTTP `200 OK`

```json
{
  "success": true,
  "ip": "203.0.113.25",
  "proxy_header": "203.0.113.25"
}
```

**Response without a proxy header:**

```json
{
  "success": true,
  "ip": "203.0.113.25",
  "proxy_header": null
}
```

**Failed IP detection:**

HTTP `400 Bad Request`

```json
{
  "success": false,
  "ip": null,
  "proxy_header": null
}
```

#### JSON fields

| Field | Type | Description |
|---|---|---|
| `success` | Boolean | Whether a valid IP address was detected |
| `ip` | String or null | Detected and normalized client IP |
| `proxy_header` | String or null | Raw `X-Real-IP` header received from the request |

The `ip` field contains the address selected for detection. The `proxy_header` field reports the received header independently of whether proxy trust is enabled.

### Authentication errors

When authentication is enabled, requests without a valid token receive HTTP `401 Unauthorized`.

```text
Unauthorized
```

When authentication is disabled, no token is required.

Unknown endpoints and unsupported HTTP methods receive HTTP `404 Not Found`.

## Configuration

All settings are supplied through environment variables.

| Variable | Default | Description |
|---|---|---|
| `API_TOKEN` | Unset | Optional static Bearer authentication token |
| `HOST` | `0.0.0.0` | Address on which the service listens |
| `PORT` | `8080` | TCP listening port |
| `TRUST_PROXY` | `false` | Whether to trust the `X-Real-IP` header |

### Authentication behavior

Authentication is controlled by `API_TOKEN`:

- **Token configured:** all requests require a matching Bearer token.
- **Token omitted or empty:** anonymous access is allowed.

The token is supplied at runtime and does not need to be included in the Docker image.

### Proxy handling

By default, the service uses the direct TCP connection address (`req.socket.remoteAddress`).

When `TRUST_PROXY=true`, the service uses the `X-Real-IP` header if it is present.

The JSON endpoint always reports the received `X-Real-IP` header, regardless of the `TRUST_PROXY` setting.

**Important:** Enable proxy trust only when the application is accessible exclusively through a trusted reverse proxy that overwrites `X-Real-IP`. Never expose the container directly to untrusted clients while proxy trust is enabled.

## Docker deployment

### Build

```bash
docker build -t docker-echo-ip:1.0 .
```

### Run with authentication

```bash
docker run -d \
  --name docker-echo-ip \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e API_TOKEN="YOUR_SECRET_TOKEN" \
  -e PORT=8080 \
  -e TRUST_PROXY=true \
  docker-echo-ip:1.0
```

### Run without authentication

```bash
docker run -d \
  --name docker-echo-ip \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e PORT=8080 \
  -e TRUST_PROXY=true \
  docker-echo-ip:1.0
```

The examples bind the container port to localhost only. This is recommended when using Nginx as a reverse proxy on the same host.

### View logs

```bash
docker logs -f docker-echo-ip
```

### Restart

```bash
docker restart docker-echo-ip
```

## Nginx reverse proxy example

The following configuration exposes both endpoints through HTTPS:

```nginx
location ~ ^/(myip|json)$ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
}
```

Configure TLS certificates in the corresponding Nginx server block.

The public endpoints will be:

```text
https://ip.example.com/myip
https://ip.example.com/json
```

If Nginx is behind Cloudflare, configure Nginx's real IP module to trust only Cloudflare's published proxy IP ranges. This ensures `$remote_addr` represents the original client IP rather than a Cloudflare proxy address.

## MikroTik RouterOS integration

The plain-text endpoint is particularly convenient for RouterOS scripts.

Example:

```routeros
:local result [/tool fetch \
    url="https://ip.example.com/myip" \
    http-header-field="Authorization: Bearer YOUR_SECRET_TOKEN" \
    output=user as-value]

:local publicIP [:trim ($result->"data")]

:put $publicIP
```

If authentication is disabled, omit `http-header-field`:

```routeros
:local result [/tool fetch \
    url="https://ip.example.com/myip" \
    output=user as-value]

:local publicIP [:trim ($result->"data")]

:put $publicIP
```

The JSON endpoint is available for diagnostics and integrations that need additional information about proxy handling.

The returned IP can be used by a RouterOS DDNS script to compare the current public IP with the previously recorded address and update a Cloudflare DNS record when necessary.

## Project structure

```text
.
├── index.js
├── Dockerfile
└── README.md
```

## Running without Docker

Node.js 22 or later is recommended.

Set the environment variables:

```bash
export API_TOKEN="YOUR_SECRET_TOKEN"
export PORT=8080
export TRUST_PROXY=false
```

Start the service:

```bash
node index.js
```

To allow anonymous requests, leave `API_TOKEN` unset.

The script also supports direct execution through its Node.js shebang:

```bash
chmod +x index.js
./index.js
```

## Security considerations

- Always expose the service through HTTPS when accessing it over the internet.
- Use a long, randomly generated API token when authentication is enabled.
- Do not store the API token in the Dockerfile or commit it to source control.
- Restrict direct access to the application port.
- Enable `TRUST_PROXY` only behind a trusted reverse proxy.
- Ensure the reverse proxy overwrites `X-Real-IP` instead of forwarding arbitrary client-supplied values.
- Anonymous mode should only be used when public access is intentional.
- Consider rotating the API token periodically.

## License

Copyright (c) 2026 xyhtac

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
