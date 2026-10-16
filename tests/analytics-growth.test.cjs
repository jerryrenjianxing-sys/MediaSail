const test=require('node:test'),assert=require('node:assert/strict');
const {canShowGrowth,unavailableGrowthReason}=require('../vendor/easel/web/frontend/src/lib/analytics.ts');
test('dashboard hides legacy, unknown and changed-account cached growth',()=>{
 const legacy={platform:'xiaohongshu',loggedIn:true,followers:900,growth:{last:{followers:800}}};
 assert.equal(canShowGrowth(legacy),false);assert.ok(unavailableGrowthReason(legacy));
 const verified={...legacy,verificationStatus:'verified',accountId:'a',source:'xiaohongshu-creator',growthStatus:'available'};
 assert.equal(canShowGrowth(verified),true);
 assert.equal(canShowGrowth(verified,{verificationStatus:'verified',accountId:'b'}),false);
 for(const change of [{accountId:null},{accountId:123},{source:123},{source:''},{verificationStatus:'unknown'},{growthStatus:'no_history'},{errorCode:'COLLECTION_FAILED'}])assert.equal(canShowGrowth({...verified,...change}),false);
 assert.equal(unavailableGrowthReason({...verified,growthStatus:'identity_unverified',growthReason:'身份未核验，当前指标仍可查看'}),'身份未核验，当前指标仍可查看');
});
