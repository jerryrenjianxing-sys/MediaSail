const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {acquire,address}=require('../desktop/single-instance.cjs');
const os=require('node:os');
test('same-named Windows accounts with different OS profile directories have different locks',t=>{t.mock.method(os,'userInfo',()=>({username:'same-name',homedir:'C:\\Users\\first'}));const first=address();t.mock.method(os,'userInfo',()=>({username:'same-name',homedir:'C:\\Users\\second'}));assert.notEqual(address(),first);assert.equal(address('isolated-test-key'),address('isolated-test-key'));});
test('same user instance raises the running app independently of library selection',async()=>{
 const key='test-'+crypto.randomUUID();let raised=0;const first=await acquire({key,onRaise:()=>raised++});
 try{assert.equal(first.primary,true);const second=await acquire({key});assert.equal(second.primary,false);assert.equal(raised,1);assert.equal(address(key),address(key));}finally{await first.close();}
 const reopened=await acquire({key});assert.equal(reopened.primary,true);await reopened.close();
});
