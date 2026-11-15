import { parseSurgeConfigInput } from '../utils/surgeConfigParser.js';

export const formLogicFn = (t) => {
    window.formData = function () {
        return {
            input: '',
            showAdvanced: false,
            // Accordion states for each section (二级手风琴状态)
            accordionSections: {
                rules: true,        // 规则选择 - 默认展开
                customRules: false, // 自定义规则
                general: false,     // 通用设置
                baseConfig: false,  // 基础配置
                ua: false          // User Agent
            },
            selectedRules: [],
            selectedPredefinedRule: 'balanced',
            subconverterCopied: false,
            groupByCountry: false,
            includeAutoSelect: true,
            enableClashUI: false,
            externalController: '',
            externalUiDownloadUrl: '',
            configType: 'singbox',
            configEditor: '',
            savingConfig: false,
            currentConfigId: '',
            saveConfigText: '',
            savingConfigText: '',
            configContentRequiredText: '',
            configSaveFailedText: '',
            configValidationState: '',
            configValidationMessage: '',
            customUA: '',
            loading: false,
            generatedLinks: null,
            shortenedLinks: null,
            shortening: false,
            customShortCode: '',
            customName: '',
            showQrModal: false,
            qrClientKey: '',
            qrClientLabel: '',
            qrDisplayName: '',
            qrUrl: '',
            qrImageCopied: false,
            qrCanvas: null,
            qrTooLong: false,
            parsingUrl: false,
            parseDebounceTimer: null,
            // These will be populated from window.APP_TRANSLATIONS
            processingText: '',
            convertText: '',
            shortenLinksText: '',
            shorteningText: '',
            showFullLinksText: '',

            init() {
                // Load translations
                if (window.APP_TRANSLATIONS) {
                    this.processingText = window.APP_TRANSLATIONS.processing;
                    this.convertText = window.APP_TRANSLATIONS.convert;
                    this.shortenLinksText = window.APP_TRANSLATIONS.shortenLinks;
                    this.shorteningText = window.APP_TRANSLATIONS.shortening;
                    this.showFullLinksText = window.APP_TRANSLATIONS.showFullLinks;
                    this.saveConfigText = window.APP_TRANSLATIONS.saveConfig;
                    this.savingConfigText = window.APP_TRANSLATIONS.savingConfig;
                    this.configContentRequiredText = window.APP_TRANSLATIONS.configContentRequired;
                    this.configSaveFailedText = window.APP_TRANSLATIONS.configSaveFailed;
                }

                // Load saved data
                this.input = localStorage.getItem('inputTextarea') || '';
                this.showAdvanced = localStorage.getItem('advancedToggle') === 'true';
                this.groupByCountry = localStorage.getItem('groupByCountry') === 'true';
                this.includeAutoSelect = localStorage.getItem('includeAutoSelect') !== 'false';
                this.enableClashUI = localStorage.getItem('enableClashUI') === 'true';
                this.externalController = localStorage.getItem('externalController') || '';
                this.externalUiDownloadUrl = localStorage.getItem('externalUiDownloadUrl') || '';
                this.customUA = localStorage.getItem('userAgent') || '';
                this.configEditor = localStorage.getItem('configEditor') || '';
                this.configType = localStorage.getItem('configType') || 'singbox';
                this.customShortCode = localStorage.getItem('customShortCode') || '';
                this.customName = localStorage.getItem('customName') || '';
                const initialUrlParams = new URLSearchParams(window.location.search);
                this.currentConfigId = initialUrlParams.get('configId') || '';

                // Load accordion states
                const savedAccordion = localStorage.getItem('accordionSections');
                if (savedAccordion) {
                    try {
                        this.accordionSections = JSON.parse(savedAccordion);
                    } catch (e) {
                        // If parsing fails, keep defaults
                    }
                }

                // Initialize rules
                this.applyPredefinedRule();

                // Watchers to save state
                this.$watch('input', val => {
                    localStorage.setItem('inputTextarea', val);
                    this.handleInputChange(val);
                });
                this.$watch('showAdvanced', val => localStorage.setItem('advancedToggle', val));
                this.$watch('groupByCountry', val => localStorage.setItem('groupByCountry', val));
                this.$watch('includeAutoSelect', val => localStorage.setItem('includeAutoSelect', val));
                this.$watch('enableClashUI', val => localStorage.setItem('enableClashUI', val));
                this.$watch('externalController', val => localStorage.setItem('externalController', val));
                this.$watch('externalUiDownloadUrl', val => localStorage.setItem('externalUiDownloadUrl', val));
                this.$watch('customUA', val => localStorage.setItem('userAgent', val));
                this.$watch('configEditor', val => {
                    localStorage.setItem('configEditor', val);
                    this.resetConfigValidation();
                });
                this.$watch('configType', val => {
                    localStorage.setItem('configType', val);
                    this.resetConfigValidation();
                });
                this.$watch('customShortCode', val => localStorage.setItem('customShortCode', val));
                this.$watch('customName', val => localStorage.setItem('customName', val));
                this.$watch('accordionSections', val => localStorage.setItem('accordionSections', JSON.stringify(val)), { deep: true });
            },

            toggleAccordion(section) {
                this.accordionSections[section] = !this.accordionSections[section];
            },

            applyPredefinedRule() {
                if (this.selectedPredefinedRule === 'custom') return;

                // PREDEFINED_RULE_SETS will be injected globally
                const rules = window.PREDEFINED_RULE_SETS;
                if (rules && rules[this.selectedPredefinedRule]) {
                    this.selectedRules = rules[this.selectedPredefinedRule];
                }
            },

            getSubconverterUrl() {
                const origin = window.location.origin;
                const params = new URLSearchParams();

                // Use preset name directly if a predefined rule set is selected
                if (this.selectedPredefinedRule && this.selectedPredefinedRule !== 'custom') {
                    params.append('selectedRules', this.selectedPredefinedRule);
                } else if (this.selectedPredefinedRule === 'custom') {
                    params.append('selectedRules', JSON.stringify(this.selectedRules));
                }

                if (!this.includeAutoSelect) {
                    params.append('include_auto_select', 'false');
                }

                if (this.groupByCountry) {
                    params.append('group_by_country', 'true');
                }

                // Include lang parameter so subconverter gets correct group names
                const appLang = window.APP_LANG || 'zh-CN';
                if (appLang !== 'zh-CN') {
                    params.append('lang', appLang);
                }

                const queryString = params.toString();
                return origin + '/subconverter' + (queryString ? '?' + queryString : '');
            },

            copySubconverterUrl() {
                const url = this.getSubconverterUrl();
                navigator.clipboard.writeText(url).then(() => {
                    this.subconverterCopied = true;
                    setTimeout(() => this.subconverterCopied = false, 2000);
                }).catch(() => {});
            },

            resetConfigValidation() {
                this.configValidationState = '';
                this.configValidationMessage = '';
            },

            async saveBaseConfig() {
                const content = (this.configEditor || '').trim();
                if (!content) {
                    alert(this.configContentRequiredText || window.APP_TRANSLATIONS.configContentRequired);
                    return;
                }

                let payloadContent = this.configEditor;
                if (this.configType === 'surge') {
                    try {
                        const { configObject } = parseSurgeConfigInput(this.configEditor);
                        payloadContent = JSON.stringify(configObject);
                    } catch (parseError) {
                        const prefix = window.APP_TRANSLATIONS.configValidationError || 'Config validation error:';
                        alert(`${prefix} ${parseError?.message || ''}`.trim());
                        return;
                    }
                }

                this.savingConfig = true;
                try {
                    const response = await fetch('/config', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: this.configType,
                            content: payloadContent
                        })
                    });
                    const responseText = await response.text();
                    if (!response.ok) {
                        throw new Error(responseText || response.statusText || 'Request failed');
                    }
                    const configId = responseText.trim();
                    if (!configId) {
                        throw new Error('Missing config ID');
                    }
                    this.currentConfigId = configId;
                    this.updateConfigIdInUrl(configId);

                    const successMessage = window.APP_TRANSLATIONS.saveConfigSuccess || 'Configuration saved successfully!';
                    alert(`${successMessage}\nID: ${configId}`);
                } catch (error) {
                    console.error('Failed to save base config:', error);
                    const errorPrefix = this.configSaveFailedText || window.APP_TRANSLATIONS.configSaveFailed || 'Failed to save configuration';
                    alert(`${errorPrefix}: ${error?.message || 'Unknown error'}`);
                } finally {
                    this.savingConfig = false;
                }
            },

            validateBaseConfig() {
                const content = (this.configEditor || '').trim();
                if (!content) {
                    this.configValidationState = 'error';
                    this.configValidationMessage = this.configContentRequiredText || window.APP_TRANSLATIONS.configContentRequired;
                    return;
                }

                try {
                    if (this.configType === 'clash') {
                        if (!window.jsyaml || !window.jsyaml.load) {
                            throw new Error(window.APP_TRANSLATIONS.parserUnavailable || 'Parser unavailable. Please refresh and try again.');
                        }
                        window.jsyaml.load(content);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validYamlConfig || 'YAML config is valid';
                    } else if (this.configType === 'surge') {
                        parseSurgeConfigInput(this.configEditor);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validJsonConfig || 'JSON config is valid';
                    } else {
                        JSON.parse(content);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validJsonConfig || 'JSON config is valid';
                    }
                } catch (error) {
                    this.configValidationState = 'error';
                    const prefix = window.APP_TRANSLATIONS.configValidationError || 'Config validation error: ';
                    this.configValidationMessage = `${prefix}${error?.message || ''}`;
                }
            },

            clearBaseConfig() {
                if (confirm(window.APP_TRANSLATIONS.confirmClearConfig)) {
                    this.configEditor = '';
                    localStorage.removeItem('configEditor');
                    this.currentConfigId = '';
                    this.updateConfigIdInUrl(null);
                }
            },

            clearAll() {
                if (confirm(window.APP_TRANSLATIONS.confirmClearAll)) {
                    this.input = '';
                    this.customName = '';
                    this.generatedLinks = null;
                    this.shortenedLinks = null;
                    this.customShortCode = '';
                    // Also clear from localStorage
                    localStorage.removeItem('customShortCode');
                    localStorage.removeItem('customName');
                }
            },

            updateConfigIdInUrl(configId) {
                const url = new URL(window.location.href);
                if (configId) {
                    url.searchParams.set('configId', configId);
                } else {
                    url.searchParams.delete('configId');
                }
                window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
            },

            async submitForm() {
                this.loading = true;
                this.shortenedLinks = null; // Reset shortened links when generating new links
                try {
                    // Get custom rules from the child component via the hidden input
                    const customRulesInput = document.querySelector('input[name="customRules"]');
                    const customRules = customRulesInput && customRulesInput.value ? JSON.parse(customRulesInput.value) : [];

                    // Construct URLs
                    const origin = window.location.origin;
                    const params = new URLSearchParams();
                    params.append('config', this.input);
                    params.append('ua', this.customUA);
                    params.append('selectedRules', JSON.stringify(this.selectedRules));
                    params.append('customRules', JSON.stringify(customRules));

                    if (this.customName && this.customName.trim()) {
                        params.append('name', this.customName.trim());
                    }

                    if (this.groupByCountry) params.append('group_by_country', 'true');
                    if (!this.includeAutoSelect) params.append('include_auto_select', 'false');
                    if (this.enableClashUI) params.append('enable_clash_ui', 'true');
                    if (this.externalController) params.append('external_controller', this.externalController);
                    if (this.externalUiDownloadUrl) params.append('external_ui_download_url', this.externalUiDownloadUrl);

                    // Add configId if present in URL
                    const urlParams = new URLSearchParams(window.location.search);
                    const configId = this.currentConfigId || urlParams.get('configId');
                    if (configId) {
                        params.append('configId', configId);
                    }

                    const queryString = params.toString();

                    this.generatedLinks = {
                        xray: origin + '/xray?' + queryString,
                        singbox: origin + '/singbox?' + queryString,
                        clash: origin + '/clash?' + queryString,
                        surge: origin + '/surge?' + queryString
                    };

                    // Scroll to results
                    setTimeout(() => {
                        const resultsDiv = document.querySelector('.mt-12');
                        if (resultsDiv) {
                            resultsDiv.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 100);

                } catch (error) {
                    console.error('Error generating links:', error);
                    alert(window.APP_TRANSLATIONS.errorGeneratingLinks);
                } finally {
                    this.loading = false;
                }
            },

            async shortenLinks() {
                // Check if links are already shortened
                if (this.shortenedLinks) {
                    alert(window.APP_TRANSLATIONS.alreadyShortened);
                    return;
                }

                if (!this.generatedLinks) {
                    return;
                }

                this.shortening = true;
                try {
                    const origin = window.location.origin;
                    const shortened = {};

                    // Use custom short code if provided, otherwise let backend generate it once
                    let shortCode = this.customShortCode.trim();
                    let isFirstRequest = true;

                    // Shorten each link type
                    for (const [type, url] of Object.entries(this.generatedLinks)) {
                        try {
                            let apiUrl = `${origin}/shorten-v2?url=${encodeURIComponent(url)}`;

                            // For the first request, either use custom code or let backend generate
                            // For subsequent requests, use the code from first request
                            if (shortCode) {
                                apiUrl += `&shortCode=${encodeURIComponent(shortCode)}`;
                            }

                            const response = await fetch(apiUrl);
                            if (!response.ok) {
                                throw new Error(`Failed to shorten ${type} link`);
                            }
                            const returnedCode = await response.text();

                            // If this is the first request and no custom code was provided,
                            // use the backend-generated code for all subsequent requests
                            if (isFirstRequest && !shortCode) {
                                shortCode = returnedCode;
                            }
                            isFirstRequest = false;

                            // Map types to their corresponding path prefixes
                            const prefixMap = {
                                xray: 'x',
                                singbox: 'b',
                                clash: 'c',
                                surge: 's'
                            };

                            shortened[type] = `${origin}/${prefixMap[type]}/${returnedCode}`;
                        } catch (error) {
                            console.error(`Error shortening ${type} link:`, error);
                            throw error;
                        }
                    }

                    this.shortenedLinks = shortened;
                } catch (error) {
                    console.error('Error shortening links:', error);
                    alert(window.APP_TRANSLATIONS.shortenFailed);
                } finally {
                    this.shortening = false;
                }
            },

            // Handle input change with debounce
            handleInputChange(val) {
                // Clear previous timer
                if (this.parseDebounceTimer) {
                    clearTimeout(this.parseDebounceTimer);
                }

                // If input is empty, don't try to parse
                if (!val || !val.trim()) {
                    return;
                }

                // Debounce for 500ms
                this.parseDebounceTimer = setTimeout(() => {
                    this.tryParseSubscriptionUrl(val.trim());
                }, 500);
            },

            // Check if input looks like a subscription URL
            isSubscriptionUrl(text) {
                // Check if it's a single line URL (not multiple lines)
                if (text.includes('\n')) {
                    return false;
                }

                try {
                    const url = new URL(text);
                    // Check if it matches our short link pattern: /[bcxs]/[code]
                    const pathMatch = url.pathname.match(/^\/([bcxs])\/([a-zA-Z0-9_-]+)$/);
                    if (pathMatch) {
                        return true;
                    }

                    // Check if it's a full subscription URL with query params
                    const fullMatch = url.pathname.match(/^\/(singbox|clash|xray|surge)$/);
                    if (fullMatch && url.search) {
                        return true;
                    }

                    return false;
                } catch {
                    return false;
                }
            },

            // Try to parse subscription URL
            async tryParseSubscriptionUrl(text) {
                if (!this.isSubscriptionUrl(text)) {
                    return;
                }

                this.parsingUrl = true;
                try {
                    let urlToParse;

                    try {
                        urlToParse = new URL(text);
                    } catch {
                        return;
                    }

                    // Check if it's a short link
                    const shortMatch = urlToParse.pathname.match(/^\/([bcxs])\/([a-zA-Z0-9_-]+)$/);

                    if (shortMatch) {
                        // It's a short link, resolve it first
                        const response = await fetch(`/resolve?url=${encodeURIComponent(text)}`);
                        if (!response.ok) {
                            console.warn('Failed to resolve short URL');
                            return;
                        }

                        const data = await response.json();
                        if (!data.originalUrl) {
                            console.warn('No original URL returned');
                            return;
                        }

                        urlToParse = new URL(data.originalUrl);
                    }

                    // Now parse the full URL and populate form
                    this.populateFormFromUrl(urlToParse);

                    // Show a success message
                    const message = window.APP_TRANSLATIONS?.urlParsedSuccess || '已成功解析订阅链接配置';
                    console.log(message);

                } catch (error) {
                    console.error('Error parsing subscription URL:', error);
                } finally {
                    this.parsingUrl = false;
                }
            },

            // Populate form fields from parsed URL
            populateFormFromUrl(url) {
                const params = new URLSearchParams(url.search);

                // Extract config (the original subscription URLs)
                const config = params.get('config');
                if (config) {
                    this.input = config;
                }

                // Extract selectedRules
                const selectedRules = params.get('selectedRules');
                if (selectedRules) {
                    try {
                        const parsed = JSON.parse(selectedRules);
                        if (Array.isArray(parsed)) {
                            this.selectedRules = parsed;
                            this.selectedPredefinedRule = 'custom';
                        }
                    } catch (e) {
                        console.warn('Failed to parse selectedRules:', e);
                    }
                }

                // Extract customRules
                const customRules = params.get('customRules');
                if (customRules) {
                    try {
                        const parsed = JSON.parse(customRules);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            // Dispatch custom event for CustomRules component to listen
                            window.dispatchEvent(new CustomEvent('restore-custom-rules', {
                                detail: { rules: parsed }
                            }));
                        }
                    } catch (e) {
                        console.warn('Failed to parse customRules:', e);
                    }
                }

                // Extract other parameters
                this.groupByCountry = params.get('group_by_country') === 'true';
                this.includeAutoSelect = params.get('include_auto_select') !== 'false';
                this.enableClashUI = params.get('enable_clash_ui') === 'true';

                const externalController = params.get('external_controller');
                if (externalController) {
                    this.externalController = externalController;
                }

                const externalUiDownloadUrl = params.get('external_ui_download_url');
                if (externalUiDownloadUrl) {
                    this.externalUiDownloadUrl = externalUiDownloadUrl;
                }

                const ua = params.get('ua');
                if (ua) {
                    this.customUA = ua;
                }

                const configId = params.get('configId');
                if (configId) {
                    this.currentConfigId = configId;
                    this.updateConfigIdInUrl(configId);
                }

                const name = params.get('name');
                if (name) {
                    this.customName = name;
                }

                // Expand advanced options if any advanced settings are present
                if (selectedRules || customRules || this.groupByCountry || this.enableClashUI ||
                    externalController || externalUiDownloadUrl || ua || configId) {
                    this.showAdvanced = true;
                }
            },

            openQrModal(clientKey, clientLabel) {
                const links = this.shortenedLinks || this.generatedLinks;
                if (!links || !links[clientKey]) return;

                const url = links[clientKey];
                const baseName = (this.customName || '').trim();
                const displayName = baseName ? `${baseName} (${clientLabel})` : clientLabel;

                this.qrClientKey = clientKey;
                this.qrClientLabel = clientLabel;
                this.qrDisplayName = displayName;
                this.qrUrl = url;
                this.qrImageCopied = false;
                this.qrTooLong = false;
                this.showQrModal = true;

                this.$nextTick(() => {
                    this.renderQrCode();
                });
            },

            closeQrModal() {
                this.showQrModal = false;
                this.qrImageCopied = false;
            },

            renderQrCode() {
                const container = document.getElementById('qrCanvasContainer');
                if (!container) return;
                container.innerHTML = '';

                if (typeof window.qrcode !== 'function') {
                    console.error('qrcode library not found');
                    return;
                }

                try {
                    // Level 'L' allows maximum data capacity for long URLs
                    const qr = window.qrcode(0, 'L');
                    qr.addData(this.qrUrl);
                    qr.make();

                    const moduleCount = qr.getModuleCount();
                    const qrPixelSize = 220;
                    const padding = 20;
                    const headerHeight = 52;
                    const footerHeight = 32;

                    const width = qrPixelSize + padding * 2;
                    const height = qrPixelSize + padding * 2 + headerHeight + footerHeight;

                    const scale = 2; // High-DPI canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = width * scale;
                    canvas.height = height * scale;
                    canvas.style.width = width + 'px';
                    canvas.style.height = height + 'px';
                    canvas.style.maxWidth = '100%';
                    canvas.style.display = 'block';

                    const ctx = canvas.getContext('2d');
                    ctx.scale(scale, scale);

                    // Background: Pure clean white card
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);

                    // Top Link Name (二维码上方显示链接名字)
                    ctx.fillStyle = '#111827';
                    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let text = this.qrDisplayName || this.qrClientLabel;
                    const maxTextWidth = width - 24;
                    if (ctx.measureText(text).width > maxTextWidth) {
                        while (text.length > 3 && ctx.measureText(text + '...').width > maxTextWidth) {
                            text = text.slice(0, -1);
                        }
                        text += '...';
                    }
                    ctx.fillText(text, width / 2, padding + 14);

                    // Divider
                    ctx.strokeStyle = '#e5e7eb';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(padding, padding + 32);
                    ctx.lineTo(width - padding, padding + 32);
                    ctx.stroke();

                    // Render QR Code Modules
                    const qrStartY = padding + headerHeight;
                    const cellSize = qrPixelSize / moduleCount;
                    ctx.fillStyle = '#000000';
                    for (let r = 0; r < moduleCount; r++) {
                        for (let c = 0; c < moduleCount; c++) {
                            if (qr.isDark(r, c)) {
                                ctx.fillRect(
                                    padding + c * cellSize,
                                    qrStartY + r * cellSize,
                                    cellSize + 0.4,
                                    cellSize + 0.4
                                );
                            }
                        }
                    }

                    // Bottom Footer: scan to import
                    ctx.fillStyle = '#6b7280';
                    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif';
                    ctx.textAlign = 'center';
                    const scanHint = (window.APP_TRANSLATIONS && window.APP_TRANSLATIONS.scanToImport) || '扫码导入配置';
                    ctx.fillText(scanHint, width / 2, height - 14);

                    this.qrCanvas = canvas;
                    container.appendChild(canvas);
                    this.qrTooLong = false;
                } catch (err) {
                    console.error('Failed to generate QR code:', err);
                    this.qrTooLong = true;
                }
            },

            async copyQrImage() {
                if (!this.qrCanvas || this.qrTooLong) return;
                try {
                    this.qrCanvas.toBlob(async (blob) => {
                        if (!blob) {
                            this.downloadQrImage();
                            return;
                        }
                        try {
                            if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
                                await navigator.clipboard.write([
                                    new ClipboardItem({ 'image/png': blob })
                                ]);
                                this.qrImageCopied = true;
                                setTimeout(() => { this.qrImageCopied = false; }, 2500);
                                return;
                            }
                        } catch (clipErr) {
                            console.warn('ClipboardItem write failed, fallback to download:', clipErr);
                        }
                        // Fallback: download image
                        this.downloadQrImage();
                        this.qrImageCopied = true;
                        setTimeout(() => { this.qrImageCopied = false; }, 2500);
                    }, 'image/png');
                } catch (e) {
                    console.error('Failed to copy QR image:', e);
                    this.downloadQrImage();
                }
            },

            downloadQrImage() {
                if (!this.qrCanvas || this.qrTooLong) return;
                const link = document.createElement('a');
                link.download = (this.qrDisplayName || 'subscription-qrcode').replace(/[\\/:*?"<>|]/g, '_') + '.png';
                link.href = this.qrCanvas.toDataURL('image/png');
                link.click();
            }
        }
    }
};
