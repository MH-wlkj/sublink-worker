import { parseServerInfo, decodeBase64 } from '../../utils.js';

const KNOWN_SCHEMES = new Set([
    'http', 'https', 'vmess', 'vless', 'trojan', 'ss', 'shadowsocks',
    'hysteria', 'hysteria2', 'hy2', 'tuic', 'anytls'
]);

function isHostPort(str) {
    if (!str) return false;
    if (str.startsWith('[')) {
        const closeBracket = str.indexOf(']');
        if (closeBracket > 1 && str.charAt(closeBracket + 1) === ':') {
            const portStr = str.slice(closeBracket + 2);
            const port = parseInt(portStr, 10);
            return Number.isInteger(port) && port > 0 && port <= 65535;
        }
        return false;
    }
    const parts = str.split(':');
    if (parts.length === 2) {
        const port = parseInt(parts[1], 10);
        return parts[1] === String(port) && port > 0 && port <= 65535 && parts[0].length > 0 && !/\s/.test(parts[0]);
    }
    return false;
}

/**
 * Check whether a string matches raw SOCKS format (e.g. host:port:user:pass or host:port)
 * @param {string} str
 * @returns {boolean}
 */
export function isRawSocksFormat(str) {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!trimmed) return false;

    // Must not be a standard URI scheme (e.g. vmess://, ss://, http://)
    if (/^[a-zA-Z0-9_-]+:\/\//.test(trimmed)) return false;

    // Strip hash/tag
    const hashIndex = trimmed.indexOf('#');
    const main = (hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed).trim();
    if (!main) return false;

    // Format 1: user:pass@host:port or user@host:port
    if (main.includes('@')) {
        const atIndex = main.lastIndexOf('@');
        const hostPort = main.slice(atIndex + 1);
        return isHostPort(hostPort);
    }

    // Format 2: [ipv6]:port[:user:pass]
    if (main.startsWith('[')) {
        const closeBracket = main.indexOf(']');
        if (closeBracket > 1 && main.charAt(closeBracket + 1) === ':') {
            const rest = main.slice(closeBracket + 2);
            const parts = rest.split(':');
            const port = parseInt(parts[0], 10);
            return Number.isInteger(port) && port > 0 && port <= 65535;
        }
        return false;
    }

    // Format 3: host:port[:user:pass]
    const parts = main.split(':');
    if (parts.length >= 2) {
        const schemeCandidate = parts[0].toLowerCase();
        if (KNOWN_SCHEMES.has(schemeCandidate)) {
            return false;
        }
        const port = parseInt(parts[1], 10);
        if (parts[1] === String(port) && port > 0 && port <= 65535 && parts[0].length > 0 && !/\s/.test(parts[0])) {
            return true;
        }
    }

    return false;
}

/**
 * Parse a SOCKS5 proxy from a URL or raw format string
 * @param {string} url
 * @returns {object|null}
 */
export function parseSocks(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    let server = '';
    let server_port = 0;
    let username = undefined;
    let password = undefined;
    let tag = '';
    let tls = undefined;

    if (trimmed.startsWith('tg://socks?') || trimmed.startsWith('tg://proxy?')) {
        try {
            const queryPart = trimmed.split('?')[1] || '';
            const params = new URLSearchParams(queryPart);
            server = params.get('server') || '';
            server_port = parseInt(params.get('port'), 10) || 0;
            username = params.get('user') || undefined;
            password = params.get('pass') || undefined;
            tag = params.get('name') || '';
        } catch (_) {
            return null;
        }
    } else if (trimmed.startsWith('socks5://') || trimmed.startsWith('socks://')) {
        const withoutScheme = trimmed.replace(/^socks5?:\/\//i, '');
        const hashIndex = withoutScheme.indexOf('#');
        let body = hashIndex >= 0 ? withoutScheme.slice(0, hashIndex) : withoutScheme;
        if (hashIndex >= 0) {
            try {
                tag = decodeURIComponent(withoutScheme.slice(hashIndex + 1).trim());
            } catch (_) {
                tag = withoutScheme.slice(hashIndex + 1).trim();
            }
        }

        // Query params
        const qIndex = body.indexOf('?');
        if (qIndex >= 0) {
            const queryString = body.slice(qIndex + 1);
            body = body.slice(0, qIndex);
            try {
                const params = new URLSearchParams(queryString);
                if (params.get('tls') === '1' || params.get('tls') === 'true') {
                    tls = {
                        enabled: true,
                        server_name: params.get('sni') || undefined,
                        insecure: params.get('insecure') === '1' || params.get('skip-cert-verify') === 'true'
                    };
                }
            } catch (_) {}
        }

        // Check if body is base64 encoded
        if (!body.includes('@') && !body.includes(':')) {
            try {
                const decoded = decodeBase64(body);
                if (decoded && (decoded.includes('@') || decoded.includes(':'))) {
                    body = decoded;
                }
            } catch (_) {}
        }

        if (body.includes('@')) {
            const atIndex = body.lastIndexOf('@');
            let authPart = body.slice(0, atIndex);
            const hostPortPart = body.slice(atIndex + 1);

            if (!authPart.includes(':')) {
                try {
                    const decodedAuth = decodeBase64(authPart);
                    if (decodedAuth && decodedAuth.includes(':')) {
                        authPart = decodedAuth;
                    }
                } catch (_) {}
            }

            const colonIndex = authPart.indexOf(':');
            if (colonIndex >= 0) {
                try {
                    username = decodeURIComponent(authPart.slice(0, colonIndex));
                    password = decodeURIComponent(authPart.slice(colonIndex + 1));
                } catch (_) {
                    username = authPart.slice(0, colonIndex);
                    password = authPart.slice(colonIndex + 1);
                }
            } else if (authPart) {
                try {
                    username = decodeURIComponent(authPart);
                } catch (_) {
                    username = authPart;
                }
            }

            const parsed = parseServerInfo(hostPortPart);
            server = parsed.host;
            server_port = parsed.port;
        } else if (body.startsWith('[')) {
            const closeBracket = body.indexOf(']');
            server = body.slice(1, closeBracket);
            const rest = body.slice(closeBracket + 1);
            const parts = rest.split(':').filter(Boolean);
            server_port = parseInt(parts[0], 10);
            if (parts.length > 1) {
                try {
                    username = decodeURIComponent(parts[1]);
                    password = parts.length > 2 ? decodeURIComponent(parts.slice(2).join(':')) : undefined;
                } catch (_) {
                    username = parts[1];
                    password = parts.length > 2 ? parts.slice(2).join(':') : undefined;
                }
            }
        } else {
            const parts = body.split(':');
            server = parts[0];
            server_port = parseInt(parts[1], 10);
            if (parts.length > 2) {
                try {
                    username = decodeURIComponent(parts[2]);
                    password = parts.length > 3 ? decodeURIComponent(parts.slice(3).join(':')) : undefined;
                } catch (_) {
                    username = parts[2];
                    password = parts.length > 3 ? parts.slice(3).join(':') : undefined;
                }
            }
        }
    } else if (isRawSocksFormat(trimmed)) {
        const hashIndex = trimmed.indexOf('#');
        let body = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
        if (hashIndex >= 0) {
            try {
                tag = decodeURIComponent(trimmed.slice(hashIndex + 1).trim());
            } catch (_) {
                tag = trimmed.slice(hashIndex + 1).trim();
            }
        }

        if (body.includes('@')) {
            const atIndex = body.lastIndexOf('@');
            const authPart = body.slice(0, atIndex);
            const hostPortPart = body.slice(atIndex + 1);

            const colonIndex = authPart.indexOf(':');
            if (colonIndex >= 0) {
                username = authPart.slice(0, colonIndex);
                password = authPart.slice(colonIndex + 1);
            } else if (authPart) {
                username = authPart;
            }

            const parsed = parseServerInfo(hostPortPart);
            server = parsed.host;
            server_port = parsed.port;
        } else if (body.startsWith('[')) {
            const closeBracket = body.indexOf(']');
            server = body.slice(1, closeBracket);
            const rest = body.slice(closeBracket + 1);
            const parts = rest.split(':').filter(Boolean);
            server_port = parseInt(parts[0], 10);
            if (parts.length > 1) username = parts[1];
            if (parts.length > 2) password = parts.slice(2).join(':');
        } else {
            const parts = body.split(':');
            server = parts[0];
            server_port = parseInt(parts[1], 10);
            if (parts.length > 2) {
                username = parts[2];
                if (parts.length > 3) {
                    password = parts.slice(3).join(':');
                }
            }
        }
    } else {
        return null;
    }

    if (!server || !server_port || isNaN(server_port) || server_port <= 0 || server_port > 65535) {
        return null;
    }

    if (!tag) {
        tag = `${server}:${server_port}`;
    }

    const config = {
        tag,
        type: 'socks',
        server,
        server_port: Number(server_port),
        version: '5',
        network: 'tcp',
        tcp_fast_open: false
    };

    if (username) config.username = username;
    if (password) config.password = password;
    if (tls) config.tls = tls;

    return config;
}

/**
 * Format a SOCKS proxy object into standard socks5:// URI
 * @param {object} proxy
 * @returns {string}
 */
export function toSocks5Url(proxy) {
    if (!proxy || !proxy.server || !proxy.server_port) return '';
    let auth = '';
    if (proxy.username && proxy.password) {
        auth = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`;
    } else if (proxy.username) {
        auth = `${encodeURIComponent(proxy.username)}@`;
    }
    const tag = proxy.tag ? `#${encodeURIComponent(proxy.tag)}` : '';
    return `socks5://${auth}${proxy.server}:${proxy.server_port}${tag}`;
}
