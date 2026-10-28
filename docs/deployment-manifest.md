# DA$H Deployment Manifest

## Arc Testnet Deployment — 2026-10-28

All four contracts deployed to Arc Testnet (chain ID 5042002).
Deployer: Arc Studio platform wallet `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`

| Contract | Address | Tx Hash | Explorer |
|---|---|---|---|
| HandleRegistry | `0x34cae0957ec0cd2327e134f2008ee111e66ca081` | `0x4c03c375c437923394fbfa419c6b258233a2247d2b1a8b1aaba9ed3f6de61712` | [View](https://explorer.testnet.arc.io/address/0x34cae0957ec0cd2327e134f2008ee111e66ca081) |
| KycRegistry | `0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd` | `0x46b6652dd939639b57ba3443faea5784c2cbbe31bab531cb839e3ec54fa05f3b` | [View](https://explorer.testnet.arc.io/address/0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd) |
| PayRouter | `0x9f2c221a4c7b0287ea03dca3877676ecc75ba1f8` | `0x8a63db564b2607035208aaf14ebdee31dafd40144d75271434a4a37ff86f82e4` | [View](https://explorer.testnet.arc.io/address/0x9f2c221a4c7b0287ea03dca3877676ecc75ba1f8) |
| ScheduledPayouts | `0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917` | `0xe22a6703aa4b63bfdd03c6dff18df6b7425dd396821d5d2396315bcced31ce4c` | [View](https://explorer.testnet.arc.io/address/0x95f13b64172e6df601fd6cec3f3c0b71d0e6f917) |

## Chain Facts Verified

| Fact | Value | Status |
|---|---|---|
| Arc Testnet chain ID | 5042002 | Confirmed |
| Arc Mainnet chain ID | 5042 | Confirmed |
| Arc Testnet RPC | `https://rpc.testnet.arc.io` | Live (via Arc Studio proxy) |
| Arc Mainnet RPC | `https://rpc.mainnet.arc.io` | Live (read-only verified) |
| USDC ERC-20 (both chains) | `0x3600000000000000000000000000000000000000` | decimals()=6 confirmed on-chain |
| Permit2 canonical (both chains) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | allowance() call succeeded on both |

## On-Chain Config Verified (Testnet)

| Config | Expected | On-chain |
|---|---|---|
| PayRouter.globalPerPaymentCap | 25000000 (25 USDC) | 25000000 |
| PayRouter.minBillTier | 0 | 0 |
| PayRouter.orderTimeoutSeconds | 1800 | 1800 |
| PayRouter.feeBps | 0 | 0 |
| PayRouter.feeWallet | deployer | 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42 |
| PayRouter DEFAULT_ADMIN_ROLE | deployer | hasRole=true confirmed |
| ScheduledPayouts.globalPerPaymentCap | 25000000 | 25000000 |

## Constructor Arguments Used

### HandleRegistry
```
initialAdmin: 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
reservedHandleHashes: [] (empty for testnet)
```

### KycRegistry
```
initialAdmin: 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
```

### PayRouter
```
usdc_:                    0x3600000000000000000000000000000000000000
kycRegistry_:             0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd
handleRegistry_:          0x34cae0957ec0cd2327e134f2008ee111e66ca081
permit2_:                 0x000000000022D473030F116dDEE9F6B43aC78BA3
initialAdmin:             0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
feeWallet_:               0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
tier0Config:              {perPaymentCap: 5000000, dailyCap: 50000000}
tier1Config:              {perPaymentCap: 100000000, dailyCap: 20000000000}
tier2Config:              {perPaymentCap: 20000000000, dailyCap: 0}
initialGlobalPerPaymentCap: 25000000
minBillTier_:             0
orderTimeoutSeconds_:     1800
initialFeeBps:            0
initialBillers:           [] (empty, add billers via governance timelock after deploy)
```

### ScheduledPayouts
```
usdc_:                    0x3600000000000000000000000000000000000000
permit2_:                 0x000000000022D473030F116dDEE9F6B43aC78BA3
initialAdmin:             0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
kycRegistry_:             0x3a480497c8d48c065dac5fdd46ea339aeb9a8bfd
globalPerPaymentCap_:     25000000
tierPerPaymentCap0_:      5000000
tierPerPaymentCap1_:      100000000
tierPerPaymentCap2_:      20000000000
```

## Test Results

- 234/234 unit tests pass (0 failed, 0 skipped)
- Fuzz tests: 256 runs each for HandleRegistry and KycRegistry
- Includes 10 permissionless tests proving Tier-0 wallets can send, createOrder, deposit, claim

## Notes

- Testnet admin role is held by the shared platform deployer wallet.
- On mainnet, a dedicated multisig or hardware wallet must hold DEFAULT_ADMIN_ROLE.
- OPERATOR_ROLE is not yet granted on testnet (no billers registered). 
  Grant it to your hot wallet before testing `fulfillOrder`.
- Billers must be registered via `queueConfigChange(CHANGE_ADD_BILLER, ...)` 
  then `executeConfigChange` (24-hour timelock) or passed in constructor.
- For quick testnet testing you can pass initialBillers in the constructor.
