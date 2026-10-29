# BSC NFT Mint

Halaman dApp statis untuk menghubungkan wallet (MetaMask, Trust Wallet, Rabby, OKX, dan wallet lain yang mendukung EIP-1193/EIP-6963) ke BNB Smart Chain, lalu:

- Deploy koleksi NFT ERC-721 milik sendiri (`contract/MyNFT.sol`, berbasis OpenZeppelin 5).
- Mint NFT ke koleksi tersebut (metadata on-chain sebagai `data:` URI, atau token URI sendiri).
- Memanggil fungsi mint di contract NFT lain, misalnya `mint(uint256)` beserta harga dalam BNB.

Semua transaksi ditandatangani di wallet pengguna. Halaman ini tidak pernah meminta private key atau seed phrase.

## Build

```
npm install
(cd contract && npm install && node compile.js)   # menghasilkan MyNFT.json
node build.js                                      # menghasilkan index.html
```
