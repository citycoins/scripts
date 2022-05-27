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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenTransfer = exports.promptUser = void 0;
require("cross-fetch/polyfill");
const prompts_1 = __importDefault(require("prompts"));
const utils_1 = require("../lib/utils");
const stacks_1 = require("../lib/stacks");
const citycoins_1 = require("../lib/citycoins");
const clarity_1 = require("micro-stacks/clarity");
const transactions_1 = require("micro-stacks/transactions");
// set default fee to save time/prompts
const DEFAULT_FEE = 10000; // 0.01 STX, avg is 0.003 STX
function promptUser() {
    return __awaiter(this, void 0, void 0, function* () {
        // set submit action for prompts
        // to add CityCoin contract values
        // TODO: generalize this same way as CityCoins UI
        // using constants returned from CityCoins API
        const submit = (prompt, answer, answers) => {
            if (prompt.name === "citycoin") {
                switch (answer) {
                    case "MIA":
                        answers.contractAddress = "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R";
                        answers.tokenContract = "miamicoin-token-v2";
                        answers.tokenName = "miamicoin";
                        break;
                    case "NYC":
                        answers.contractAddress = "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11";
                        answers.tokenContract = "newyorkcitycoin-token-v2";
                        answers.tokenName = "newyorkcitycoin";
                        break;
                }
            }
        };
        (0, utils_1.printDivider)();
        console.log("SET CONFIGURATION");
        (0, utils_1.printDivider)();
        // prompt for user config
        const userConfig = yield (0, prompts_1.default)([
            {
                type: "select",
                name: "citycoin",
                message: "Select a CityCoin to transfer:",
                choices: [
                    { title: "MiamiCoin (MIA)", value: "MIA" },
                    { title: "NewYorkCityCoin (NYC)", value: "NYC" },
                ],
            },
            {
                type: "text",
                name: "stxSender",
                message: "Stacks Address to transfer from?",
                validate: (value) => (value === "" ? "Stacks address is required" : true),
            },
            {
                type: "password",
                name: "stxPrivateKey",
                message: "Private Key for sender address?",
                validate: (value) => value === "" ? "Stacks private key is required" : true,
            },
            {
                type: "text",
                name: "stxRecipient",
                message: "Stacks Address to send to?",
                validate: (value) => (value === "" ? "Stacks address is required" : true),
            },
            {
                type: "number",
                name: "transferAmount",
                message: "Amount of CityCoins to transfer? (in micro-units)",
                validate: (value) => (value > 0 ? true : "Value must be greater than 0"),
            },
            {
                type: "text",
                name: "transferMemo",
                message: "Memo? (up to 32 characters)",
                validate: (value) => (value.length < 32
                    ? true
                    : "Value must be 32 characters or less."),
            },
        ], {
            onCancel: (prompt) => (0, utils_1.cancelPrompt)(prompt.name),
            onSubmit: submit,
        });
        return userConfig;
    });
}
exports.promptUser = promptUser;
function tokenTransfer(config) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, utils_1.debugLog)(JSON.stringify(config));
        (0, utils_1.printDivider)();
        console.log("CONFIRM AMOUNT");
        (0, utils_1.printDivider)();
        // confirm transfer amount
        console.log(`From:   ${config.stxSender}`);
        console.log(`To:     ${config.stxRecipient}`);
        console.log(`Amount: ${(config.transferAmount / stacks_1.MICRO_UNITS).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} ${config.citycoin}`);
        console.log(`Memo:   ${config.transferMemo}`);
        const { confirmAmount } = yield (0, prompts_1.default)([
            {
                type: "confirm",
                name: "confirmAmount",
                message: `Confirm transfer details?`,
                initial: false,
            },
        ], {
            onCancel: (prompt) => (0, utils_1.cancelPrompt)(prompt.name),
        });
        !confirmAmount && (0, utils_1.exitError)("Transfer not confirmed, transaction canceled.");
        (0, utils_1.printDivider)();
        console.log("BUILD TRANSACTION");
        (0, utils_1.printDivider)();
        // get balance, verify balance > transfer amount
        const balance = yield (0, citycoins_1.getCCBalance)('v2', config.citycoin, config.stxSender);
        (0, utils_1.debugLog)(`balance: ${balance}`);
        if (balance < config.transferAmount) {
            (0, utils_1.exitError)(`Insufficient balance: ${balance} < ${config.transferAmount}`);
        }
        // get nonce
        const nonce = yield (0, stacks_1.getNonce)(config.stxSender);
        (0, utils_1.debugLog)(`nonce: ${nonce}`);
        // create clarity values
        const amountCV = (0, clarity_1.uintCV)(config.transferAmount);
        const fromCV = (0, clarity_1.standardPrincipalCV)(config.stxSender);
        const toCV = (0, clarity_1.standardPrincipalCV)(config.stxRecipient);
        // memo is an optional buff 34 which can be:
        // none or some(buff 34)
        const memoCV = config.transferMemo.length > 0 ? (0, clarity_1.someCV)((0, clarity_1.bufferCVFromString)(config.transferMemo)) : (0, clarity_1.noneCV)();
        // create tx options
        const txOptions = {
            contractAddress: config.contractAddress,
            contractName: config.tokenContract,
            functionName: "transfer",
            functionArgs: [amountCV, fromCV, toCV, memoCV],
            senderKey: config.stxPrivateKey,
            fee: DEFAULT_FEE,
            nonce: nonce,
            postConditionMode: transactions_1.PostConditionMode.Deny,
            postConditions: [
                (0, transactions_1.makeStandardFungiblePostCondition)(config.stxSender, transactions_1.FungibleConditionCode.Equal, amountCV.value, (0, transactions_1.createAssetInfo)(config.contractAddress, config.tokenContract, config.tokenName))
            ],
            network: stacks_1.STACKS_NETWORK,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        (0, utils_1.printDivider)();
        console.log("SUBMIT TRANSACTION");
        (0, utils_1.printDivider)();
        // make contract call
        const transaction = yield (0, transactions_1.makeContractCall)(txOptions);
        // print raw serialized transaction
        const serializedTx = Buffer.from(transaction.serialize()).toString('hex');
        (0, utils_1.debugLog)(`serialized transaction hex:\n${serializedTx}`);
        // broadcast transaction
        const broadcast = yield (0, transactions_1.broadcastTransaction)(transaction, stacks_1.STACKS_NETWORK);
        (0, utils_1.debugLog)(JSON.stringify(broadcast));
        // print txid and link
        (0, utils_1.printDivider)();
        (0, utils_1.debugLog)(`TXID: ${transaction.txid()}`);
        (0, utils_1.debugLog)(`LINK: https://explorer.stacks.co/txid/0x${transaction.txid()}`);
        (0, utils_1.printDivider)();
        (0, utils_1.exitSuccess)("Transfer succesfully submitted, exiting...");
    });
}
exports.tokenTransfer = tokenTransfer;
(0, utils_1.disclaimerIntro)("Token Transfer", "Builds and submits a CityCoin token transfer on Stacks", true);
promptUser().then(config => tokenTransfer(config));
