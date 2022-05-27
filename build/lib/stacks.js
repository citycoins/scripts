"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNonce = exports.getStacksBlockHeight = exports.STACKS_NETWORK = exports.MICRO_UNITS = void 0;
const network_1 = require("micro-stacks/network");
const utils_1 = require("./utils");
// stacks constants
exports.MICRO_UNITS = 1000000;
exports.STACKS_NETWORK = new network_1.StacksMainnet({ coreApiUrl: "https://stacks-node-api.stacks.co" });
// get current Stacks block height
function getStacksBlockHeight() {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `${exports.STACKS_NETWORK.getCoreApiUrl()}/v2/info`;
        const currentBlockResult = yield (0, utils_1.fetchJson)(url);
        const currentBlock = +currentBlockResult.stacks_tip_height;
        (0, utils_1.debugLog)(`currentBlock: ${currentBlock}`);
        return currentBlock;
    });
}
exports.getStacksBlockHeight = getStacksBlockHeight;
// get current nonce for account
// https://stacks-node-api.mainnet.stacks.co/extended/v1/address/{principal}/nonces
function getNonce(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `${exports.STACKS_NETWORK.getCoreApiUrl()}/extended/v1/address/${address}/nonces`;
        const nonceResult = yield (0, utils_1.fetchJson)(url);
        const nonce = +nonceResult.possible_next_nonce;
        return nonce;
    });
}
exports.getNonce = getNonce;
