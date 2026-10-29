const esbuild = require('esbuild'); const fs = require('fs');
const r = esbuild.buildSync({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('index.html', fs.readFileSync('src/index.html', 'utf8').replace('/*APP*/', () => js));
fs.writeFileSync('dist/index.html', fs.readFileSync('src/index.html', 'utf8').replace('/*APP*/', () => js));
console.log('dist/index.html', fs.statSync('dist/index.html').size);
