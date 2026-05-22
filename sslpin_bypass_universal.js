// sslpin_bypass_universal.js
// VERSION ULTRA-STABLE POUR LE LAB 15
// Bypass universel du SSL Pinning Android (Java-side)
// Cible: SSLContext, X509TrustManager, Conscrypt, OkHttp3, WebView

setTimeout(function() {
  Java.perform(function() {
    console.log("[*] DÉMARRAGE DU BYPASS STABLE...");
    console.log("[*] SCRIPT ACTIF. VOUS POUVEZ CLIQUER.");

    const ArrayList = Java.use('java.util.ArrayList');
    function ok(tag) { console.log('[+] BYPASS:', tag); }

    // 1) Force Proxy (Burp/mitmproxy) via OkHttp
    try {
      var OkHttpClientBuilder = Java.use('okhttp3.OkHttpClient$Builder');
      var Proxy = Java.use('java.net.Proxy');
      var InetSocketAddress = Java.use('java.net.InetSocketAddress');
      var ProxyType = Java.use('java.net.Proxy$Type');
      var proxyAddr = InetSocketAddress.$new("10.0.2.2", 8080);
      var myProxy = Proxy.$new(ProxyType.valueOf("HTTP"), proxyAddr);

      OkHttpClientBuilder.proxy.implementation = function(p) {
        console.log("[+] PROXY REDIRIGÉ VERS BURP");
        return this.proxy(myProxy);
      };
    } catch (e) { console.log("[-] OkHttp Proxy Hook impossible"); }

    // 2) Bypass OkHttp CertificatePinner.check
    try {
      var CertificatePinner = Java.use('okhttp3.CertificatePinner');
      CertificatePinner.check.overloads.forEach(function(ov) {
        ov.implementation = function() {
          console.log("[+] BYPASS: OkHttp Pinning");
          return;
        };
      });
      ok('okhttp3.CertificatePinner.check');
    } catch (e) { console.log("[-] OkHttp Pinner Hook impossible"); }

    // 3) Bypass Système (Conscrypt TrustManagerImpl)
    ['com.android.org.conscrypt.TrustManagerImpl', 'org.conscrypt.TrustManagerImpl'].forEach(function(cls) {
      try {
        var TMI = Java.use(cls);
        ['checkTrusted', 'verifyChain', 'checkServerTrusted'].forEach(function(m) {
          if (TMI[m]) {
            TMI[m].overloads.forEach(function(ov) {
              ov.implementation = function() {
                ok('TrustManager Système');
                try { return ov.apply(this, arguments); } catch(e) {
                  try { return ArrayList.$new(); } catch(_) { return null; }
                }
              };
            });
          }
        });
        ok(cls + ' patché');
      } catch(e) { /* classe non disponible */ }
    });

    // 4) SSLContext.init — injecter un TrustManager permissif si aucun n'est fourni
    try {
      const SSLContext = Java.use('javax.net.ssl.SSLContext');
      SSLContext.init.overload(
        '[Ljavax.net.ssl.KeyManager;',
        '[Ljavax.net.ssl.TrustManager;',
        'java.security.SecureRandom'
      ).implementation = function(km, tm, sr) {
        let useTm = tm;
        try {
          if (!tm || tm.length === 0) {
            const X509TM = Java.registerClass({
              name: 'com.frida.FriendlyTM',
              implements: [Java.use('javax.net.ssl.X509TrustManager')],
              methods: {
                checkClientTrusted: function(chain, authType) {},
                checkServerTrusted: function(chain, authType) {},
                getAcceptedIssuers: function() {
                  return Java.array('java.security.cert.X509Certificate', []);
                }
              }
            });
            const TMArr = Java.use('[Ljavax.net.ssl.TrustManager;');
            const arr = TMArr.$new(1);
            arr[0] = X509TM.$new();
            useTm = arr;
            ok('Injected permissive TrustManager');
          }
        } catch(e) { /* silencieux */ }
        return this.init(km, useTm, sr);
      };
      ok('SSLContext.init patched');
    } catch(e) { console.log('[-] SSLContext.init patch failed:', e.message); }

    // 5) Patch large des implémentations X509TrustManager
    try {
      Java.enumerateLoadedClasses({
        onMatch: function(name) {
          const low = name.toLowerCase();
          if (low.includes('trust') || low.includes('pin')) {
            try {
              const K = Java.use(name);
              ['checkServerTrusted', 'checkClientTrusted'].forEach(function(m) {
                if (K[m]) {
                  K[m].overloads.forEach(function(ov) {
                    ov.implementation = function() {
                      ok(name + '.' + m + ' -> allow');
                      return null;
                    };
                  });
                }
              });
            } catch(_) { }
          }
        },
        onComplete: function() { ok('X509TrustManager patches attempted'); }
      });
    } catch(e) { console.log('[-] enumerateLoadedClasses failed:', e.message); }

    // 6) WebView: ignorer les erreurs SSL
    try {
      const WVC = Java.use('android.webkit.WebViewClient');
      if (WVC.onReceivedSslError) {
        WVC.onReceivedSslError.implementation = function(view, handler, error) {
          ok('WebView onReceivedSslError -> proceed');
          handler.proceed();
        };
      }
    } catch(e) { /* WebView non présent */ }

    console.log('[+] Universal SSL pinning bypass installed');
  });
}, 0);
