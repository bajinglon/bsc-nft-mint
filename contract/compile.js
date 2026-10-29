const solc = require('solc'); const fs = require('fs'); const path = require('path');
const input = { language: 'Solidity', sources: { 'MyNFT.sol': { content: fs.readFileSync('MyNFT.sol','utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi','evm.bytecode.object'] } } } };
function findImports(p){ try { return { contents: fs.readFileSync(path.join('node_modules', p),'utf8') }; } catch(e){ return { error: 'not found' }; } }
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errs = (out.errors||[]).filter(e=>e.severity==='error'); if (errs.length) { console.error(errs); process.exit(1); }
const c = out.contracts['MyNFT.sol'].MyNFT;
fs.writeFileSync('../MyNFT.json', JSON.stringify({ abi: c.abi, bytecode: '0x'+c.evm.bytecode.object }));
console.log('ok', c.evm.bytecode.object.length/2, 'bytes');
