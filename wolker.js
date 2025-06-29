import { connect } from "cloudflare:sockets";

// URL untuk daftar proxy dan daftar domain
const proxyListURL = 'https://raw.githubusercontent.com/Raisolah/proxyuodate/df29abb4577bcaf9cff5cae3fdbcf50e75b9770d/proxymajdi.txt';
const domainListURL = 'https://raw.githubusercontent.com/Raisolah/proxyuodate/refs/heads/main/domain.txt';

// Konfigurasi dasar
const namaWeb = 'BANGJDI PROXY';
const telegramku = '';
const telegrambot = '';
const waku = '';
const waku1 = '';

// Daftar wildcard yang sudah ada
const wildcards = [
  'ava.game.naver.com',
  'business.blibli.com',
  'graph.instagram.com',
  'quiz.int.vidio.com',
  'live.iflix.com',
  'support.zoom.us',
  'blog.webex.com',
  'investors.spotify.com',
  'cache.netflix.com',
  'zaintest.vuclip.com',
  'ads.ruangguru.com',
  'api.midtrans.com',
  'investor.fb.com',
];

// Variabel Global
let cachedProxyList = [];
let proxyIP = "";

// Konstanta
const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

/**
 * Mengambil dan menyimpan daftar proxy dari URL.
 * @param {boolean} forceReload - Paksa memuat ulang daftar dari URL.
 * @returns {Promise<Array>} - Daftar proxy yang telah di-cache.
 */
async function getProxyList(forceReload = false) {
  if (!cachedProxyList.length || forceReload) {
    if (!proxyListURL) {
      throw new Error("No Proxy List URL Provided!");
    }

    const proxyBank = await fetch(proxyListURL);
    if (proxyBank.status === 200) {
      const proxyString = ((await proxyBank.text()) || "").split("\n").filter(Boolean);
      cachedProxyList = proxyString
        .map((entry) => {
          const [proxyIP, proxyPort, country, org] = entry.split(",");
          return {
            proxyIP: proxyIP || "Unknown",
            proxyPort: proxyPort || "Unknown",
            country: country.toUpperCase() || "Unknown",
            org: org || "Unknown Org",
          };
        })
        .filter(Boolean);
    }
  }

  return cachedProxyList;
}

/**
 * Melakukan reverse proxy ke target yang ditentukan.
 * @param {Request} request - Request yang masuk.
 * @param {string} target - Hostname target.
 * @returns {Promise<Response>} - Response dari target.
 */
async function reverseProxy(request, target) {
  const targetUrl = new URL(request.url);
  targetUrl.hostname = target;

  const modifiedRequest = new Request(targetUrl, request);
  modifiedRequest.headers.set("X-Forwarded-Host", request.headers.get("Host"));

  const response = await fetch(modifiedRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("X-Proxied-By", "Cloudflare Worker");

  return newResponse;
}

export default {
  /**
   * Handler utama untuk setiap request yang masuk ke worker.
   * @param {Request} request - Objek request.
   * @param {object} env - Variabel lingkungan.
   * @param {object} ctx - Konteks eksekusi.
   * @returns {Promise<Response>} - Objek response.
   */
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const upgradeHeader = request.headers.get("Upgrade");
      
      // Handle IP check (fitur ini tetap ada)
      if (url.pathname === "/check") {
        // ... (kode untuk /check tetap sama)
      }      

      // Map untuk menyimpan proxy per country code
      const proxyState = new Map();

      // Fungsi untuk memperbarui proxy setiap menit
      async function updateProxies() {
        const proxies = await getProxyList(env);
        const groupedProxies = groupBy(proxies, "country");

        for (const [countryCode, proxies] of Object.entries(groupedProxies)) {
          const randomIndex = Math.floor(Math.random() * proxies.length);
          proxyState.set(countryCode, proxies[randomIndex]);
        }
      }

      // Jalankan pembaruan proxy secara periodik
      ctx.waitUntil(
        (async function periodicUpdate() {
          await updateProxies();
          setInterval(updateProxies, 60000); // Setiap 60 detik
        })()
      );

      // Handler untuk koneksi WebSocket
      if (upgradeHeader === "websocket") {
        // ... (logika websockerHandler tetap sama)
      }
      
      const myhost = url.hostname;
      const type = url.searchParams.get('type') || 'mix';
      const tls = url.searchParams.get('tls') !== 'false';
      const wildcard = url.searchParams.get('wildcard') === 'true';
      const bugs = url.searchParams.get('bug') || myhost;
      const wildcrd = wildcard ? `${bugs}.${myhost}` : myhost;
      const country = url.searchParams.get('country');
      const limit = parseInt(url.searchParams.get('limit'), 10);
      let configs;

      // Routing berdasarkan path
      switch (url.pathname) {
        case '/api/clash':
          configs = await generateClashSub(type, bugs, wildcrd, tls, country, limit);
          break;
        case '/api/surfboard':
          configs = await generateSurfboardSub(type, bugs, wildcrd, tls, country, limit);
          break;
        case '/api/singbox':
          configs = await generateSingboxSub(type, bugs, wildcrd, tls, country, limit);
          break;
        case '/api/husi':
          configs = await generateHusiSub(type, bugs, wildcrd, tls, country, limit);
          break;
        case '/api/nekobox':
          configs = await generateNekoboxSub(type, bugs, wildcrd, tls, country, limit);
          break;
        case '/api/v2rayng':
          configs = await generateV2rayngSub(type, bugs, wildcrd, tls, country, limit);
          break;
        case '/api/v2ray':
          configs = await generateV2raySub(type, bugs, wildcrd, tls, country, limit);
          break;
        case "/":
          // Mengalihkan halaman utama ke /api
          return Response.redirect(new URL('/api', request.url), 302);
        case "/api":
          // Menampilkan halaman generator subscription
          return new Response(await handleSubRequest(url.hostname), { headers: { 'Content-Type': 'text/html' } });
        default:
          // Jika path tidak ditemukan, kembalikan 404
          return new Response('Not Found', { status: 404 });
      }

      return new Response(configs);
    } catch (err) {
      return new Response(`An error occurred: ${err.toString()}`, {
        status: 500,
      });
    }
  },
};

/**
 * Helper function untuk mengelompokkan array objek berdasarkan key.
 * @param {Array} array - Array yang akan dikelompokkan.
 * @param {string} key - Kunci untuk mengelompokkan.
 * @returns {object} - Objek yang telah dikelompokkan.
 */
function groupBy(array, key) {
  return array.reduce((result, currentValue) => {
    (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
    return result;
  }, {});
}

/**
 * Menghasilkan HTML untuk halaman generator subscription (/api).
 * @param {string} hostnem - Hostname dari request.
 * @returns {Promise<string>} - String HTML.
 */
async function handleSubRequest(hostnem) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BANSOS| PROXY |  | LIFETIME</title>
    <meta name="description" content="FREE | CF | PROXY | LIFETIME">
    <link href="https://kere.us.kg/img/botvpn.jpg" rel="icon" type="image/png">
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <style>
        :root {
            --color-primary: #00ff88;
            --color-secondary: #00ffff;
            --color-background: #0a0f1a;
            --color-card: rgba(15, 22, 36, 0.95);
            --color-text: #e0f4f4;
            --transition: all 0.3s ease;
        }
        body {
            font-family: 'Inter', sans-serif;
            background: var(--color-background);
            color: var(--color-text);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 1rem;
        }
        .container {
            width: 100%;
            max-width: 500px;
        }
        .card {
            background: var(--color-card);
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0, 255, 136, 0.1);
            border: 1px solid rgba(0, 255, 136, 0.2);
        }
        .title {
            text-align: center;
            color: var(--color-primary);
            margin-bottom: 1.5rem;
            font-size: 2rem;
            font-weight: 700;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        .form-control {
            width: 100%;
            padding: 0.75rem 1rem;
            background: rgba(0, 255, 136, 0.05);
            border: 2px solid rgba(0, 255, 136, 0.3);
            border-radius: 8px;
            color: var(--color-text);
            transition: var(--transition);
        }
        .form-control:focus {
            border-color: var(--color-secondary);
        }
        .btn {
            width: 100%;
            padding: 0.75rem;
            background: var(--color-primary);
            color: var(--color-background);
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
        }
        .btn:hover {
            background: var(--color-secondary);
        }
        .result {
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(0, 255, 136, 0.1);
            border-radius: 8px;
            word-break: break-all;
        }
        .copy-btns {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }
        .copy-btn {
            flex-grow: 1;
            background: rgba(0, 255, 136, 0.2);
            color: var(--color-primary);
            padding: 0.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1 class="title">${namaWeb}</h1>
            <center style="margin-bottom: 1.5rem;">
              <a href="https://bangjdi.eu.org" target="_blank" rel="noopener noreferrer">
                <button style="background-color: #cde033; color: black; border: none; padding: 8px 16px; cursor: pointer; border-radius: 5px; font-weight: 600;">Home Page</button>
              </a>
            </center>
            <form id="subLinkForm">
                <div class="form-group">
                    <label for="app">Aplikasi</label>
                    <select id="app" class="form-control" required>
                        <option value="v2ray">V2RAY</option>
                        <option value="v2rayng">V2RAYNG</option>
                        <option value="clash">CLASH</option>
                        <option value="nekobox">NEKOBOX</option>
                        <option value="singbox">SINGBOX</option>
                        <option value="surfboard">SURFBOARD</option>
                        <option value="husi">HUSI</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="domain">Pilihan Domain</label>
                    <select id="domain" class="form-control" required>
                        <option value="">Memuat domain...</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="configType">Tipe Config</label>
                    <select id="configType" class="form-control" required>
                        <option value="vless">VLESS</option>
                        <option value="trojan">TROJAN</option>
                        <option value="ss">SHADOWSOCKS</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="tls">TLS/NTLS</label>
                    <select id="tls" class="form-control">
                        <option value="true">TLS 443</option>
                        <option value="false">NTLS 80</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="wildcard">Wildcard</label>
                    <select id="wildcard" class="form-control">
                        <option value="false">OFF</option>
                        <option value="true">ON</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="country">Negara</label>
                    <select id="country" class="form-control">
                        <option value="all">ALL COUNTRY</option>
                        <option value="RANDOM">RANDOM</option>
                        <option value="SG">Singapore</option>
                        <option value="US">United States</option>
                        <option value="ID">Indonesia</option>
                        <!-- Daftar negara lainnya -->
                    </select>
                </div>

                <div class="form-group">
                    <label for="limit">Jumlah Config</label>
                    <input type="number" id="limit" class="form-control" min="1" max="999999" value="10" required>
                </div>

                <button type="submit" class="btn">Generate Sub Link</button>
            </form>

            <div id="result" class="result" style="display: none;">
                <p id="generated-link"></p>
                <div class="copy-btns">
                    <button id="copyLink" class="copy-btn">Copy Link</button>
                    <button id="openLink" class="copy-btn">Buka Link</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const form = document.getElementById('subLinkForm');
            const resultEl = document.getElementById('result');
            const generatedLinkEl = document.getElementById('generated-link');
            const copyLinkBtn = document.getElementById('copyLink');
            const openLinkBtn = document.getElementById('openLink');
            
            const elements = {
                app: document.getElementById('app'),
                domain: document.getElementById('domain'),
                configType: document.getElementById('configType'),
                tls: document.getElementById('tls'),
                wildcard: document.getElementById('wildcard'),
                country: document.getElementById('country'),
                limit: document.getElementById('limit')
            };

            // Fungsi untuk mengambil dan mengisi pilihan domain
            async function populateDomains() {
                try {
                    const response = await fetch('${domainListURL}');
                    if (!response.ok) throw new Error('Gagal mengambil daftar domain');
                    const text = await response.text();
                    const domains = text.trim().split('\\n').filter(Boolean);
                    
                    const domainSelect = elements.domain;
                    domainSelect.innerHTML = '<option value="">Pilih Domain</option>'; // Hapus placeholder "Memuat..."
                    
                    domains.forEach(domain => {
                        const option = document.createElement('option');
                        option.value = domain;
                        option.textContent = domain;
                        domainSelect.appendChild(option);
                    });
                } catch (error) {
                    console.error('Error populating domains:', error);
                    elements.domain.innerHTML = '<option value="">Gagal memuat domain</option>';
                }
            }

            // Panggil fungsi untuk mengisi domain saat halaman dimuat
            populateDomains();

            // Handler untuk submit form
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                if (!elements.domain.value) {
                    Swal.fire('Error', 'Silakan pilih domain terlebih dahulu.', 'error');
                    return;
                }

                const params = new URLSearchParams({
                    type: elements.configType.value,
                    bug: elements.domain.value.trim(),
                    tls: elements.tls.value,
                    wildcard: elements.wildcard.value,
                    limit: elements.limit.value,
                    ...(elements.country.value !== 'all' && { country: elements.country.value })
                });

                const generatedLink = \`/api/\${elements.app.value}?\${params.toString()}\`;
                const fullUrl = \`https://\${window.location.hostname}\${generatedLink}\`;

                resultEl.style.display = 'block';
                generatedLinkEl.textContent = fullUrl;

                copyLinkBtn.onclick = () => {
                    navigator.clipboard.writeText(fullUrl).then(() => {
                        Swal.fire('Berhasil!', 'Link berhasil disalin!', 'success');
                    }).catch(err => {
                        Swal.fire('Gagal', 'Tidak dapat menyalin link.', 'error');
                    });
                };

                openLinkBtn.onclick = () => {
                    window.open(fullUrl, '_blank');
                };
            });
        });
    </script>
</body>
</html>
 `;
return html
}

// Handler WebSocket dan fungsi-fungsi lainnya (websockerHandler, protocolSniffer, dll.)
// tetap sama seperti di file asli. Perubahan hanya pada routing dan halaman UI.
// Pastikan untuk menyalin sisa kode dari file asli Anda ke sini, dimulai dari
// async function websockerHandler(request) { ... }
// hingga akhir file.

async function websockerHandler(request) {
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);

  webSocket.accept();

  let addressLog = "";
  let portLog = "";
  const log = (info, event) => {
    console.log(`[${addressLog}:${portLog}] ${info}`, event || "");
  };
  const earlyDataHeader = request.headers.get("sec-websocket-protocol") || "";

  const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

  let remoteSocketWrapper = {
    value: null,
  };
  let udpStreamWrite = null;
  let isDNS = false;

  readableWebSocketStream
    .pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (isDNS && udpStreamWrite) {
            return udpStreamWrite(chunk);
          }
          if (remoteSocketWrapper.value) {
            const writer = remoteSocketWrapper.value.writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
            return;
          }

          const protocol = await protocolSniffer(chunk);
          let protocolHeader;

          if (protocol === "Trojan") {
            protocolHeader = parseTrojanHeader(chunk);
          } else if (protocol === "VLESS") {
            protocolHeader = parseVlessHeader(chunk);
          } else if (protocol === "Shadowsocks") {
            protocolHeader = parseShadowsocksHeader(chunk);
          } else {
            parseVmessHeader(chunk);
            throw new Error("Unknown Protocol!");
          }

          addressLog = protocolHeader.addressRemote;
          portLog = `${protocolHeader.portRemote} -> ${protocolHeader.isUDP ? "UDP" : "TCP"}`;

          if (protocolHeader.hasError) {
            throw new Error(protocolHeader.message);
          }

          if (protocolHeader.isUDP) {
            if (protocolHeader.portRemote === 53) {
              isDNS = true;
            } else {
              throw new Error("UDP only support for DNS port 53");
            }
          }

          if (isDNS) {
            const { write } = await handleUDPOutbound(webSocket, protocolHeader.version, log);
            udpStreamWrite = write;
            udpStreamWrite(protocolHeader.rawClientData);
            return;
          }

          handleTCPOutBound(
            remoteSocketWrapper,
            protocolHeader.addressRemote,
            protocolHeader.portRemote,
            protocolHeader.rawClientData,
            webSocket,
            protocolHeader.version,
            log
          );
        },
        close() {
          log(`readableWebSocketStream is close`);
        },
        abort(reason) {
          log(`readableWebSocketStream is abort`, JSON.stringify(reason));
        },
      })
    )
    .catch((err) => {
      log("readableWebSocketStream pipeTo error", err);
    });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

async function protocolSniffer(buffer) {
  if (buffer.byteLength >= 62) {
    const trojanDelimiter = new Uint8Array(buffer.slice(56, 60));
    if (trojanDelimiter[0] === 0x0d && trojanDelimiter[1] === 0x0a) {
      if (trojanDelimiter[2] === 0x01 || trojanDelimiter[2] === 0x03 || trojanDelimiter[2] === 0x7f) {
        if (trojanDelimiter[3] === 0x01 || trojanDelimiter[3] === 0x03 || trojanDelimiter[3] === 0x04) {
          return "Trojan";
        }
      }
    }
  }

  const vlessDelimiter = new Uint8Array(buffer.slice(1, 17));
  if (arrayBufferToHex(vlessDelimiter).match(/^\w{8}\w{4}4\w{3}[89ab]\w{3}\w{12}$/)) {
    return "VLESS";
  }

  return "Shadowsocks"; // default
}

async function handleTCPOutBound(
  remoteSocket,
  addressRemote,
  portRemote,
  rawClientData,
  webSocket,
  responseHeader,
  log
) {
  async function connectAndWrite(address, port) {
    const tcpSocket = connect({
      hostname: address,
      port: port,
    });
    remoteSocket.value = tcpSocket;
    log(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(rawClientData);
    writer.releaseLock();
    return tcpSocket;
  }

  async function retry() {
    const tcpSocket = await connectAndWrite(
      proxyIP.split(/[:=-]/)[0] || addressRemote,
      proxyIP.split(/[:=-]/)[1] || portRemote
    );
    tcpSocket.closed
      .catch((error) => {
        console.log("retry tcpSocket closed error", error);
      })
      .finally(() => {
        safeCloseWebSocket(webSocket);
      });
    remoteSocketToWS(tcpSocket, webSocket, responseHeader, null, log);
  }

  const tcpSocket = await connectAndWrite(addressRemote, portRemote);

  remoteSocketToWS(tcpSocket, webSocket, responseHeader, retry, log);
}

function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
  let readableStreamCancel = false;
  const stream = new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener("message", (event) => {
        if (readableStreamCancel) {
          return;
        }
        const message = event.data;
        controller.enqueue(message);
      });
      webSocketServer.addEventListener("close", () => {
        safeCloseWebSocket(webSocketServer);
        if (readableStreamCancel) {
          return;
        }
        controller.close();
      });
      webSocketServer.addEventListener("error", (err) => {
        log("webSocketServer has error");
        controller.error(err);
      });
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) {
        controller.error(error);
      } else if (earlyData) {
        controller.enqueue(earlyData);
      }
    },

    pull(controller) {},
    cancel(reason) {
      if (readableStreamCancel) {
        return;
      }
      log(`ReadableStream was canceled, due to ${reason}`);
      readableStreamCancel = true;
      safeCloseWebSocket(webSocketServer);
    },
  });

  return stream;
}

function parseVmessHeader(vmessBuffer) {
  // Implementasi parser VMess
}

function parseShadowsocksHeader(ssBuffer) {
    const view = new DataView(ssBuffer);
    const addressType = view.getUint8(0);
    let addressLength = 0;
    let addressValueIndex = 1;
    let addressValue = "";
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(ssBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
            break;
        case 3:
            addressLength = new Uint8Array(ssBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(ssBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 4:
            addressLength = 16;
            const dataView = new DataView(ssBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = ipv6.join(":");
            break;
        default:
            return {
                hasError: true,
                message: `Invalid addressType for Shadowsocks: ${addressType}`
            };
    }
    if (!addressValue) {
        return {
            hasError: true,
            message: `Destination address empty, address type is: ${addressType}`
        };
    }
    const portIndex = addressValueIndex + addressLength;
    const portBuffer = ssBuffer.slice(portIndex, portIndex + 2);
    const portRemote = new DataView(portBuffer).getUint16(0);
    return {
        hasError: false,
        addressRemote: addressValue,
        portRemote: portRemote,
        rawClientData: ssBuffer.slice(portIndex + 2),
        isUDP: portRemote === 53
    };
}

function parseVlessHeader(vlessBuffer) {
    const version = new Uint8Array(vlessBuffer.slice(0, 1));
    let isUDP = false;
    const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
    const cmd = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
    if (cmd === 1) {} else if (cmd === 2) {
        isUDP = true;
    } else {
        return {
            hasError: true,
            message: `command ${cmd} is not support`
        };
    }
    const portIndex = 18 + optLength + 1;
    const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
    const portRemote = new DataView(portBuffer).getUint16(0);
    let addressIndex = portIndex + 2;
    const addressBuffer = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1));
    const addressType = addressBuffer[0];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = "";
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
            break;
        case 2:
            addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 3:
            addressLength = 16;
            const dataView = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = ipv6.join(":");
            break;
        default:
            return {
                hasError: true,
                message: `invalid addressType is ${addressType}`
            };
    }
    if (!addressValue) {
        return {
            hasError: true,
            message: `addressValue is empty, addressType is ${addressType}`
        };
    }
    return {
        hasError: false,
        addressRemote: addressValue,
        portRemote: portRemote,
        rawClientData: vlessBuffer.slice(addressValueIndex + addressLength),
        version: new Uint8Array([version[0], 0]),
        isUDP: isUDP,
    };
}


function parseTrojanHeader(buffer) {
    const socks5DataBuffer = buffer.slice(58);
    if (socks5DataBuffer.byteLength < 6) {
        return {
            hasError: true,
            message: "invalid SOCKS5 request data"
        };
    }
    let isUDP = false;
    const view = new DataView(socks5DataBuffer);
    const cmd = view.getUint8(0);
    if (cmd == 3) {
        isUDP = true;
    } else if (cmd != 1) {
        throw new Error("Unsupported command type!");
    }
    let addressType = view.getUint8(1);
    let addressLength = 0;
    let addressValueIndex = 2;
    let addressValue = "";
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(socks5DataBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
            break;
        case 3:
            addressLength = new Uint8Array(socks5DataBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(socks5DataBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 4:
            addressLength = 16;
            const dataView = new DataView(socks5DataBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = ipv6.join(":");
            break;
        default:
            return {
                hasError: true,
                message: `invalid addressType is ${addressType}`
            };
    }
    if (!addressValue) {
        return {
            hasError: true,
            message: `address is empty, addressType is ${addressType}`
        };
    }
    const portIndex = addressValueIndex + addressLength;
    const portBuffer = socks5DataBuffer.slice(portIndex, portIndex + 2);
    const portRemote = new DataView(portBuffer).getUint16(0);
    return {
        hasError: false,
        addressRemote: addressValue,
        portRemote: portRemote,
        rawClientData: socks5DataBuffer.slice(portIndex + 4),
        isUDP: isUDP,
    };
}


async function remoteSocketToWS(remoteSocket, webSocket, responseHeader, retry, log) {
  let header = responseHeader;
  let hasIncomingData = false;
  await remoteSocket.readable
    .pipeTo(
      new WritableStream({
        start() {},
        async write(chunk, controller) {
          hasIncomingData = true;
          if (webSocket.readyState !== WS_READY_STATE_OPEN) {
            controller.error("webSocket.readyState is not open, maybe close");
          }
          if (header) {
            webSocket.send(await new Blob([header, chunk]).arrayBuffer());
            header = null;
          } else {
            webSocket.send(chunk);
          }
        },
        close() {
          log(`remoteConnection!.readable is close with hasIncomingData is ${hasIncomingData}`);
        },
        abort(reason) {
          console.error(`remoteConnection!.readable abort`, reason);
        },
      })
    )
    .catch((error) => {
      console.error(`remoteSocketToWS has exception `, error.stack || error);
      safeCloseWebSocket(webSocket);
    });
  if (hasIncomingData === false && retry) {
    log(`retry`);
    retry();
  }
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) {
    return { error: null };
  }
  try {
    base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    const decode = atob(base64Str);
    const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
    return { earlyData: arryBuffer.buffer, error: null };
  } catch (error) {
    return { error };
  }
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function handleUDPOutbound(webSocket, responseHeader, log) {
  let isVlessHeaderSent = false;
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      for (let index = 0; index < chunk.byteLength; ) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
        index = index + 2 + udpPakcetLength;
        controller.enqueue(udpData);
      }
    },
  });
  transformStream.readable
    .pipeTo(
      new WritableStream({
        async write(chunk) {
          const resp = await fetch("https://1.1.1.1/dns-query", {
            method: "POST",
            headers: {
              "content-type": "application/dns-message",
            },
            body: chunk,
          });
          const dnsQueryResult = await resp.arrayBuffer();
          const udpSize = dnsQueryResult.byteLength;
          const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
          if (webSocket.readyState === WS_READY_STATE_OPEN) {
            if (isVlessHeaderSent) {
              webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
            } else {
              webSocket.send(await new Blob([responseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
              isVlessHeaderSent = true;
            }
          }
        },
      })
    )
    .catch((error) => {
      log("dns udp has error" + error);
    });

  const writer = transformStream.writable.getWriter();

  return {
    write(chunk) {
      writer.write(chunk);
    },
  };
}

function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
      socket.close();
    }
  } catch (error) {
    console.error("safeCloseWebSocket error", error);
  }
}

const getEmojiFlag = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '';
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map(char => 0x1F1E6 + char.charCodeAt(0) - 65)
  );
};

// ... [ Semua fungsi generate sub (generateClashSub, generateSurfboardSub, dll.) tetap sama ] ...
// Salin semua fungsi generate... dari file asli Anda ke sini.

async function generateClashSub(type, bug, wildcrd, tls, country = null, limit = null) {
  const proxyListResponse = await fetch(proxyListURL);
  const proxyList = await proxyListResponse.text();
  let ips = proxyList
    .split('\n')
    .filter(Boolean)
  if (country && country.toLowerCase() === 'random') {
    ips = ips.sort(() => Math.random() - 0.5); 
  } else if (country) {
    ips = ips.filter(line => {
      const parts = line.split(',');
      if (parts.length > 1) {
        const lineCountry = parts[2].toUpperCase();
        return lineCountry === country.toUpperCase();
      }
      return false;
    });
  }
  
  if (limit && !isNaN(limit)) {
    ips = ips.slice(0, limit); 
  }
  
  let conf = '';
  let bmkg= '';
  let count = 1;
  
  for (let line of ips) {
    const parts = line.split(',');
    const proxyHost = parts[0];
    const proxyPort = parts[1] || 443;
    const emojiFlag = getEmojiFlag(line.split(',')[2]); 
    const sanitize = (text) => text.replace(/[\n\r]+/g, "").trim(); 
    let ispName = sanitize(`${emojiFlag} (${line.split(',')[2]}) ${line.split(',')[3]} ${count ++}`);
    const UUIDS = `${generateUUIDv4()}`;
    const ports = tls ? '443' : '80';
    const snio = tls ? `\n  servername: ${wildcrd}` : '';
    const snioo = tls ? `\n  cipher: auto` : '';
    if (type === 'vless') {
      bmkg+= `  - ${ispName}\n`
      conf += `
- name: ${ispName}
  server: ${bug}
  port: ${ports}
  type: vless
  uuid: ${UUIDS}${snioo}
  tls: ${tls}
  udp: true
  skip-cert-verify: true
  network: ws${snio}
  ws-opts:
    path: /${proxyHost}-${proxyPort}
    headers:
      Host: ${wildcrd}`;
    } else if (type === 'trojan') {
      bmkg+= `  - ${ispName}\n`
      conf += `
- name: ${ispName}
  server: ${bug}
  port: 443
  type: trojan
  password: ${UUIDS}
  udp: true
  skip-cert-verify: true
  network: ws
  sni: ${wildcrd}
  ws-opts:
    path: /${proxyHost}-${proxyPort}
    headers:
      Host: ${wildcrd}`;
    } else if (type === 'ss') {
      bmkg+= `  - ${ispName}\n`
      conf += `
- name: ${ispName}
  type: ss
  server: ${bug}
  port: ${ports}
  cipher: none
  password: ${UUIDS}
  udp: true
  plugin: v2ray-plugin
  plugin-opts:
    mode: websocket
    tls: ${tls}
    skip-cert-verify: true
    host: ${wildcrd}
    path: /${proxyHost}-${proxyPort}
    mux: false
    headers:
      custom: ${wildcrd}`;
    } else if (type === 'mix') {
      bmkg+= `  - ${ispName} vless\n  - ${ispName} trojan\n  - ${ispName} ss\n`;
      conf += `
- name: ${ispName} vless
  server: ${bug}
  port: ${ports}
  type: vless
  uuid: ${UUIDS}
  cipher: auto
  tls: ${tls}
  udp: true
  skip-cert-verify: true
  network: ws${snio}
  ws-opts:
    path: /${proxyHost}-${proxyPort}
    headers:
      Host: ${wildcrd}
- name: ${ispName} trojan
  server: ${bug}
  port: 443
  type: trojan
  password: ${UUIDS}
  udp: true
  skip-cert-verify: true
  network: ws
  sni: ${wildcrd}
  ws-opts:
    path: /${proxyHost}-${proxyPort}
    headers:
      Host: ${wildcrd}
- name: ${ispName} ss
  type: ss
  server: ${bug}
  port: ${ports}
  cipher: none
  password: ${UUIDS}
  udp: true
  plugin: v2ray-plugin
  plugin-opts:
    mode: websocket
    tls: ${tls}
    skip-cert-verify: true
    host: ${wildcrd}
    path: /${proxyHost}-${proxyPort}
    mux: false
    headers:
      custom: ${wildcrd}`;
    }
  }
  return `port: 7890
socks-port: 7891
redir-port: 7892
mixed-port: 7893
tproxy-port: 7895
ipv6: false
mode: rule
log-level: silent
allow-lan: true
external-controller: 0.0.0.0:9090
secret: ""
bind-address: "*"
unified-delay: true
profile:
  store-selected: true
  store-fake-ip: true
dns:
  enable: true
  ipv6: false
  use-host: true
  enhanced-mode: fake-ip
  listen: 0.0.0.0:7874
  nameserver:
    - 8.8.8.8
    - 1.0.0.1
    - https://dns.google/dns-query
  fallback:
    - 1.1.1.1
    - 8.8.4.4
    - https://cloudflare-dns.com/dns-query
    - 112.215.203.254
  default-nameserver:
    - 8.8.8.8
    - 1.1.1.1
    - 112.215.203.254
  fake-ip-range: 198.18.0.1/16
proxies:${conf}
proxy-groups:
- name: INTERNET
  type: select
  disable-udp: true
  proxies:
  - BEST-PING
${bmkg}
- name: BEST-PING
  type: url-test
  url: https://detectportal.firefox.com/success.txt
  interval: 60
  proxies:
${bmkg}
rules:
- MATCH,INTERNET`;
}

async function generateSurfboardSub(type, bug, wildcrd, tls, country = null, limit = null) {
  const proxyListResponse = await fetch(proxyListURL);
  const proxyList = await proxyListResponse.text();
  let ips = proxyList
    .split('\n')
    .filter(Boolean)
  if (country && country.toLowerCase() === 'random') {
    ips = ips.sort(() => Math.random() - 0.5); 
  } else if (country) {
    ips = ips.filter(line => {
      const parts = line.split(',');
      if (parts.length > 1) {
        const lineCountry = parts[2].toUpperCase();
        return lineCountry === country.toUpperCase();
      }
      return false;
    });
  }
  if (limit && !isNaN(limit)) {
    ips = ips.slice(0, limit); 
  }
  let conf = '';
  let bmkg= '';
  let count = 1;
  
  for (let line of ips) {
    const parts = line.split(',');
    const proxyHost = parts[0];
    const proxyPort = parts[1] || 443;
    const emojiFlag = getEmojiFlag(line.split(',')[2]); 
    const sanitize = (text) => text.replace(/[\n\r]+/g, "").trim(); 
    let ispName = sanitize(`${emojiFlag} (${line.split(',')[2]}) ${line.split(',')[3]} ${count ++}`);
    const UUIDS = `${generateUUIDv4()}`;
    if (type === 'trojan') {
      bmkg+= `${ispName},`
      conf += `
${ispName} = trojan, ${bug}, 443, password = ${UUIDS}, udp-relay = true, skip-cert-verify = true, sni = ${wildcrd}, ws = true, ws-path = /${proxyHost}:${proxyPort}, ws-headers = Host:"${wildcrd}"\n`;
    }
  }
  return `[General]
dns-server = system, 108.137.44.39, 108.137.44.9, puredns.org:853
[Proxy]
${conf}
[Proxy Group]
Select Group = select,Load Balance,Best Ping,FallbackGroup,${bmkg}
Load Balance = load-balance,${bmkg}
Best Ping = url-test,${bmkg} url=http://www.gstatic.com/generate_204, interval=600, tolerance=100, timeout=5
FallbackGroup = fallback,${bmkg} url=http://www.gstatic.com/generate_204, interval=600, timeout=5
[Rule]
MATCH,Select Group`;
}

// ... dan seterusnya untuk semua fungsi 'generate' lainnya

function generateUUIDv4() {
  const randomValues = crypto.getRandomValues(new Uint8Array(16));
  randomValues[6] = (randomValues[6] & 0x0f) | 0x40;
  randomValues[8] = (randomValues[8] & 0x3f) | 0x80;
  return [
    ...randomValues
  ].map(value => value.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}
