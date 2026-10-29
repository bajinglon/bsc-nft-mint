const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: require('child_process').execSync('which google-chrome').toString().trim(), headless: false, args: ['--headless=new'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.addInitScript(() => {
    let id = 0;
    const rpc = async (method, params) => {
      const r = await fetch('http://localhost:8545', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params || [] }) });
      const j = await r.json(); if (j.error) throw j.error; return j.result;
    };
    const provider = { request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts') return rpc('eth_accounts');
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      return rpc(method, params);
    }, on() {} };
    window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info: { uuid: 'test', name: 'TestWallet', icon: '', rdns: 'test' }, provider }) })));
  });
  await page.goto('http://localhost:8080/');
  await page.click('text=Connect TestWallet');
  await page.waitForSelector('#status b');
  console.log('STATUS', await page.textContent('#status'));
  await page.fill('#colName', 'Test Koleksi'); await page.fill('#colSymbol', 'TK');
  await page.click('#deployBtn');
  await page.waitForFunction(() => document.getElementById('myContract').value.startsWith('0x'), null, { timeout: 30000 });
  const addr = await page.inputValue('#myContract'); console.log('DEPLOYED', addr);
  await page.fill('#nftName', 'NFT #1'); await page.fill('#nftDesc', 'tes'); await page.fill('#nftImage', 'https://example.com/a.png');
  await page.click('#mintBtn');
  await page.waitForSelector('text=NFT berhasil di-mint', { timeout: 30000 });
  // external tab: call mint(address,string) on same contract via generic form
  await page.click('[data-tab=external]');
  await page.fill('#extContract', addr);
  await page.click('#readBtn'); await page.waitForSelector('text=totalSupply 1');
  const acct = (await (await fetch('http://localhost:8545', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_accounts","params":[]}' })).json()).result[0];
  await page.fill('#extFn', 'mint(address,string)'); await page.fill('#extArgs', JSON.stringify([acct, 'ipfs://x'])); await page.fill('#extValue', '0');
  await page.click('#extBtn'); await page.waitForSelector('text=Transaksi berhasil.', { timeout: 30000 });
  await page.click('#readBtn'); await page.waitForSelector('text=totalSupply 2');
  console.log('LOG\n' + await page.innerText('#log'));
  await page.setViewportSize({ width: 420, height: 1400 });
  await page.click('[data-tab=deploy]');
  await page.screenshot({ path: '/home/ubuntu/bsc-nft-dapp/screenshot.png', fullPage: true });
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
