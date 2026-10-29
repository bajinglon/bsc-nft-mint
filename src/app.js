import { BrowserProvider, JsonRpcProvider, ContractFactory, Contract, Interface, parseEther, getAddress, isAddress } from 'ethers';
import artifact from '../MyNFT.json';

const NETWORKS = {
  56: { chainId: '0x38', chainName: 'BNB Smart Chain Mainnet', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrls: ['https://bsc-dataseed.bnbchain.org'], blockExplorerUrls: ['https://bscscan.com'] },
  97: { chainId: '0x61', chainName: 'BNB Smart Chain Testnet', nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
        rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545'], blockExplorerUrls: ['https://testnet.bscscan.com'] },
};
const $ = (id) => document.getElementById(id);
const discovered = new Map();
let eip1193 = null, provider = null, signer = null, account = null;

function log(msg, cls) {
  const el = $('log');
  if (el.textContent === '-') el.innerHTML = '';
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.prepend(line);
}
const explorer = () => NETWORKS[$('network').value].blockExplorerUrls[0];
const txLink = (h) => `<a href="${explorer()}/tx/${h}" target="_blank" rel="noopener">${h.slice(0, 10)}…</a>`;
const addrLink = (a) => `<a href="${explorer()}/address/${a}" target="_blank" rel="noopener">${a}</a>`;
const errMsg = (e) => e?.shortMessage || e?.info?.error?.message || e?.reason || e?.message || String(e);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderWallets() {
  const box = $('wallets');
  box.innerHTML = '';
  const list = [...discovered.values()];
  if (!list.length && window.ethereum) list.push({ info: { name: 'Browser Wallet', uuid: 'injected' }, provider: window.ethereum });
  list.forEach(({ info, provider: p }) => {
    const b = document.createElement('button');
    b.textContent = `Connect ${info.name}`;
    b.onclick = () => connect(p);
    box.appendChild(b);
  });
  $('mobile').classList.toggle('hidden', list.length > 0);
}

async function ensureNetwork() {
  const net = NETWORKS[$('network').value];
  try {
    await eip1193.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainId }] });
  } catch (e) {
    if (e.code === 4902 || e?.data?.originalError?.code === 4902) {
      await eip1193.request({ method: 'wallet_addEthereumChain', params: [net] });
    } else throw e;
  }
  provider = new BrowserProvider(eip1193);
  signer = await provider.getSigner();
}

async function refreshStatus() {
  if (!provider || !account) return;
  const net = await provider.getNetwork();
  const bal = await provider.getBalance(account);
  const sym = NETWORKS[Number(net.chainId)]?.nativeCurrency.symbol || 'ETH';
  $('status').innerHTML = `Terhubung: <b>${account.slice(0, 6)}…${account.slice(-4)}</b> · chain ${net.chainId} · ${(Number(bal) / 1e18).toFixed(5)} ${sym}`;
}

async function connect(p) {
  try {
    eip1193 = p;
    const accounts = await eip1193.request({ method: 'eth_requestAccounts' });
    account = getAddress(accounts[0]);
    await ensureNetwork();
    await refreshStatus();
    ['deployBtn', 'mintBtn', 'extBtn'].forEach((id) => ($(id).disabled = false));
    log(`Wallet terhubung: ${account}`, 'ok');
    eip1193.on?.('accountsChanged', (a) => { account = a[0] ? getAddress(a[0]) : null; ensureNetwork().then(refreshStatus); });
    eip1193.on?.('chainChanged', () => { provider = new BrowserProvider(eip1193); provider.getSigner().then((s) => { signer = s; refreshStatus(); }); });
  } catch (e) { log(`Gagal connect: ${escapeHtml(errMsg(e))}`, 'err'); }
}

async function withBusy(btn, fn) {
  btn.disabled = true;
  const t = btn.textContent;
  btn.textContent = 'Menunggu wallet…';
  try { await ensureNetwork(); await fn(); await refreshStatus(); }
  catch (e) { log(escapeHtml(errMsg(e)), 'err'); }
  finally { btn.disabled = false; btn.textContent = t; }
}

$('deployBtn').onclick = () => withBusy($('deployBtn'), async () => {
  const name = $('colName').value.trim(), symbol = $('colSymbol').value.trim();
  if (!name || !symbol) throw new Error('Isi nama dan simbol koleksi.');
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const c = await factory.deploy(name, symbol, account);
  log(`Deploy dikirim: ${txLink(c.deploymentTransaction().hash)}`);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  $('myContract').value = addr;
  localStorage.setItem(`nft:${$('network').value}:${account}`, addr);
  log(`Koleksi ter-deploy: ${addrLink(addr)}`, 'ok');
});

function buildTokenUri() {
  const custom = $('nftUri').value.trim();
  if (custom) return custom;
  const meta = { name: $('nftName').value.trim(), description: $('nftDesc').value.trim(), image: $('nftImage').value.trim() };
  if (!meta.name || !meta.image) throw new Error('Isi nama NFT dan URL gambar, atau isi token URI.');
  const bytes = new TextEncoder().encode(JSON.stringify(meta));
  let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:application/json;base64,${btoa(bin)}`;
}

$('mintBtn').onclick = () => withBusy($('mintBtn'), async () => {
  const addr = $('myContract').value.trim();
  if (!isAddress(addr)) throw new Error('Alamat koleksi tidak valid.');
  const to = $('recipient').value.trim() || account;
  if (!isAddress(to)) throw new Error('Alamat penerima tidak valid.');
  const c = new Contract(addr, artifact.abi, signer);
  const tx = await c.mint(to, buildTokenUri());
  log(`Mint dikirim: ${txLink(tx.hash)}`);
  const rc = await tx.wait();
  const ev = rc.logs.map((l) => { try { return c.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === 'Transfer');
  log(`NFT berhasil di-mint${ev ? ` · token #${ev.args.tokenId}` : ''} ke ${to}`, 'ok');
});

$('readBtn').onclick = async () => {
  try {
    const addr = $('extContract').value.trim();
    if (!isAddress(addr)) throw new Error('Alamat contract tidak valid.');
    const p = provider || new JsonRpcProvider(NETWORKS[$('network').value].rpcUrls[0]);
    const c = new Contract(addr, ['function name() view returns (string)', 'function symbol() view returns (string)', 'function totalSupply() view returns (uint256)'], p);
    const [n, s, t] = await Promise.all([c.name().catch(() => '?'), c.symbol().catch(() => '?'), c.totalSupply().catch(() => '?')]);
    log(`Contract ${addrLink(addr)}: ${escapeHtml(n)} (${escapeHtml(s)}), totalSupply ${t}`);
  } catch (e) { log(escapeHtml(errMsg(e)), 'err'); }
};

$('extBtn').onclick = () => withBusy($('extBtn'), async () => {
  const addr = $('extContract').value.trim();
  if (!isAddress(addr)) throw new Error('Alamat contract tidak valid.');
  const sig = $('extFn').value.trim().replace(/^function\s+/, '');
  const iface = new Interface([`function ${sig}`]);
  const fn = iface.fragments[0];
  const args = JSON.parse($('extArgs').value.trim() || '[]');
  const value = parseEther($('extValue').value.trim() || '0');
  const c = new Contract(addr, iface, signer);
  const tx = await c[fn.format()](...args, { value });
  log(`Transaksi dikirim: ${txLink(tx.hash)}`);
  await tx.wait();
  log('Transaksi berhasil.', 'ok');
});

document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $('tab-deploy').classList.toggle('hidden', b.dataset.tab !== 'deploy');
  $('tab-external').classList.toggle('hidden', b.dataset.tab !== 'external');
}));

$('network').onchange = async () => {
  if (eip1193) { try { await ensureNetwork(); await refreshStatus(); } catch (e) { log(escapeHtml(errMsg(e)), 'err'); } }
  if (account) $('myContract').value = localStorage.getItem(`nft:${$('network').value}:${account}`) || '';
};

const here = location.href;
$('mmLink').href = `https://metamask.app.link/dapp/${here.replace(/^https?:\/\//, '')}`;
$('twLink').href = `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(here)}`;

window.addEventListener('eip6963:announceProvider', (e) => { discovered.set(e.detail.info.uuid, e.detail); renderWallets(); });
window.dispatchEvent(new Event('eip6963:requestProvider'));
setTimeout(renderWallets, 300);
