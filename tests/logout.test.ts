import test from "node:test";
import assert from "node:assert/strict";
import {authCookieNames,boundedLogout} from "../lib/account/logout";
test("local logout clears only this project's auth cookies and chunks",()=>{
  assert.deepEqual(authCookieNames("sb-test-auth-token=value; sb-test-auth-token.0=chunk; sb-test-auth-token.1=chunk; sb-other-auth-token=leave; preference=leave; sb-test-auth-token.evil=leave; sb-test-auth-token-code-verifier=private","https://test.supabase.co"),["sb-test-auth-token","sb-test-auth-token.0","sb-test-auth-token.1","sb-test-auth-token-code-verifier"]);
});
test("provider failure and hung requests clear local access without claiming remote revocation",async()=>{
  for(const request of [async()=>{throw new Error("TLS failure");},()=>new Promise<never>(()=>{})]){
    let cleared=0;const result=await boundedLogout(request,()=>{cleared++;},15);assert.equal(cleared,1);assert.equal(result.remoteRevoked,false);assert.equal(result.reloadRequired,true);
  }
});
test("confirmed server logout remains distinct from local-only logout",async()=>{
  let cleared=0;const result=await boundedLogout(async()=>({remoteRevoked:true}),()=>{cleared++;});assert.equal(cleared,1);assert.equal(result.remoteRevoked,true);
});
