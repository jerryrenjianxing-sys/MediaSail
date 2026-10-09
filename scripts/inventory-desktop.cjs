const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),lock=require('../package-lock.json');
const packages=Object.entries(lock.packages).filter(([key,p])=>key&&!p.dev&&p.version).map(([key,p])=>({name:key.split('node_modules/').at(-1),version:p.version,license:p.license,resolved:p.resolved,integrity:p.integrity}));
fs.writeFileSync(path.join(root,'licenses/desktop-packages.json'),JSON.stringify(packages,null,2)+'\n');
console.log(`Inventoried ${packages.length} desktop runtime dependencies`);
