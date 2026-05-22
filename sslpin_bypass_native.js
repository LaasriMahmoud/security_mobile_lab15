// sslpin_bypass_native.js
// Bypass du SSL Pinning implémenté en natif (BoringSSL/OpenSSL)
// Utiliser en combinaison avec sslpin_bypass_universal.js

function hook(name, lib) {
  const addr = Module.findExportByName(lib || null, name);
  if (!addr) {
    console.log('[*] Symbole introuvable:', name);
    return;
  }
  Interceptor.attach(addr, {
    onLeave(rv) {
      if (name === 'SSL_get_verify_result') {
        // 0 = X509_V_OK (validation réussie)
        console.log('[+] SSL_get_verify_result -> X509_V_OK (forcé)');
        rv.replace(ptr(0));
      }
    }
  });
  console.log('[+] Hooked natif:', name);
}

// Hook SSL_get_verify_result dans libssl.so
hook('SSL_get_verify_result', 'libssl.so');

// Hook SSL_CTX_set_verify pour désactiver la vérification du serveur
const sslCtxSetVerify = Module.findExportByName('libssl.so', 'SSL_CTX_set_verify');
if (sslCtxSetVerify) {
  Interceptor.attach(sslCtxSetVerify, {
    onEnter(args) {
      // SSL_VERIFY_NONE = 0
      args[1] = ptr(0);
      console.log('[+] SSL_CTX_set_verify -> SSL_VERIFY_NONE');
    }
  });
}

// Hook X509_verify_cert pour toujours retourner succès
const x509Verify = Module.findExportByName(null, 'X509_verify_cert');
if (x509Verify) {
  Interceptor.attach(x509Verify, {
    onLeave(retval) {
      console.log('[+] X509_verify_cert -> 1 (success)');
      retval.replace(ptr(1));
    }
  });
}

console.log('[+] Native SSL bypass hooks installés');
