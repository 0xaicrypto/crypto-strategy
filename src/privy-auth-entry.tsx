import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';

// Mantle Network definition
const mantleChain = {
  id: 5000,
  name: 'Mantle',
  network: 'mantle',
  nativeCurrency: {
    decimals: 18,
    name: 'MNT',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mantle.xyz'],
    },
    public: {
      http: ['https://rpc.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://explorer.mantle.xyz' },
  },
};

declare global {
  interface Window {
    PrivyAuth: any;
    initPrivyApp: any;
  }
}

function PrivyBridgeComponent() {
  const { login, logout, authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    // Expose control methods to window.PrivyAuth
    window.PrivyAuth = {
      isReady: ready,
      isAuthenticated: authenticated,
      user,
      wallets,
      login: () => {
        if (!ready) {
          console.warn('[PrivyAuth] Privy is not ready yet');
          return;
        }
        login();
      },
      logout: async () => {
        await logout();
      },
      getEthereumProvider: async () => {
        const active = wallets.find((w: any) => w.walletClientType === 'privy') || wallets[0];
        if (active) {
          return await active.getEthereumProvider();
        }
        return null;
      },
      onAuthStateChange: (cb: (detail: any) => void) => {
        window.addEventListener('privy_auth_change', (e: any) => {
          cb(e.detail);
        });
      },
    };

    // Broadcast state changes
    async function notifyChange() {
      let activeProvider = null;
      let activeAddress = null;
      const activeWallet = wallets.find((w: any) => w.walletClientType === 'privy') || wallets[0];
      if (activeWallet) {
        activeAddress = activeWallet.address;
        try {
          activeProvider = await activeWallet.getEthereumProvider();
        } catch (e) {
          console.warn('[PrivyAuth] Failed to get provider from active wallet:', e);
        }
      }

      const event = new CustomEvent('privy_auth_change', {
        detail: {
          isReady: ready,
          isAuthenticated: authenticated,
          user,
          address: activeAddress,
          provider: activeProvider,
          wallet: activeWallet,
        },
      });
      window.dispatchEvent(event);
    }

    notifyChange();
  }, [ready, authenticated, user, wallets]);

  return null;
}

let privyRoot: any = null;

export function initPrivy(appId: string) {
  let container = document.getElementById('privy-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'privy-root';
    document.body.appendChild(container);
  }

  if (!privyRoot) {
    privyRoot = createRoot(container);
  }

  privyRoot.render(
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'wallet', 'google', 'twitter', 'telegram'],
        appearance: {
          theme: 'dark',
          accentColor: '#00FF93',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        supportedChains: [mantleChain],
        defaultChain: mantleChain,
      }}
    >
      <PrivyBridgeComponent />
    </PrivyProvider>
  );
}

if (typeof window !== 'undefined') {
  window.initPrivyApp = initPrivy;
  const DEFAULT_PRIVY_APP_ID = 'cmuwkcbj500w40cjwqt4ywyut';
  let savedAppId = localStorage.getItem('privy_app_id');
  if (!savedAppId || savedAppId === 'clpispdty00ycl80fpueukbhl') {
    savedAppId = DEFAULT_PRIVY_APP_ID;
    localStorage.setItem('privy_app_id', DEFAULT_PRIVY_APP_ID);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initPrivy(savedAppId));
  } else {
    initPrivy(savedAppId);
  }
}
