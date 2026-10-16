const test=require('node:test'),assert=require('node:assert/strict'),{signalTestInspector}=require('../scripts/test-main-inspector.cjs');
test('fresh Electron inspector retries only the initial Windows debug mapping race',async()=>{
 let calls=0;const pid=12345;await signalTestInspector(pid,{delayMs:1,signal:target=>{assert.equal(target,pid);if(++calls<3)throw Object.assign(Error('mapping not ready'),{errno:2,syscall:'OpenFileMappingW'});}});assert.equal(calls,3);
});
test('inspector signaling keeps a finite startup budget and does not retry unrelated errors',async()=>{
 let calls=0;const failure=Object.assign(Error('missing mapping'),{errno:2,syscall:'OpenFileMappingW'});await assert.rejects(signalTestInspector(12345,{timeoutMs:0,delayMs:1,signal:()=>{calls++;throw failure;}}),error=>error===failure);assert.equal(calls,1);
 const denied=Object.assign(Error('access denied'),{errno:5,syscall:'OpenFileMappingW'});await assert.rejects(signalTestInspector(12345,{signal:()=>{throw denied;}}),error=>error===denied);
});
