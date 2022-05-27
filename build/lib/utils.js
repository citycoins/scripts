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
exports.disclaimerIntro = exports.waitUntilBlock = exports.fetchJson = exports.sleep = exports.exitError = exports.exitSuccess = exports.cancelPrompt = exports.printTimeStamp = exports.printDivider = exports.debugLog = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const throttled_queue_1 = __importDefault(require("throttled-queue"));
// debug settings for more verbose logging
const ENABLE_LOGS = true;
const debugLog = (msg) => ENABLE_LOGS && console.log(`DEBUG: ${msg}`);
exports.debugLog = debugLog;
// output helpers
const printDivider = () => console.log(`------------------------------`);
exports.printDivider = printDivider;
const printTimeStamp = () => {
    let newDate = new Date().toLocaleDateString();
    newDate = newDate.replace(/,/g, '');
    console.log(newDate);
};
exports.printTimeStamp = printTimeStamp;
// catch user exiting the prompt interface
const cancelPrompt = (promptName) => {
    (0, exports.exitError)(`ERROR: cancelled by user at ${promptName}, exiting...`);
};
exports.cancelPrompt = cancelPrompt;
// exit with status
const exitSuccess = (msg) => {
    console.log(msg);
    process.exit(0);
};
exports.exitSuccess = exitSuccess;
const exitError = (msg) => {
    console.log(msg);
    process.exit(1);
};
exports.exitError = exitError;
// async sleep timer
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
exports.sleep = sleep;
// throttle to 4 requests per second
const throttle = (0, throttled_queue_1.default)(4, 1000, true);
// fetch and return JSON from URL
const fetchJson = (url) => __awaiter(void 0, void 0, void 0, function* () {
    (0, exports.debugLog)(`fetchJson: ${url}`);
    const response = yield throttle(() => (0, node_fetch_1.default)(url));
    if (response.status === 200) {
        const json = yield response.json();
        (0, exports.debugLog)(`fetchJson: ${JSON.stringify(json)}`);
        return json;
    }
    throw new Error(`fetchJson: ${url} ${response.status} ${response.statusText}`);
});
exports.fetchJson = fetchJson;
// wait for Stacks block height before continuing
function waitUntilBlock(block) {
    return __awaiter(this, void 0, void 0, function* () {
        return true;
    });
}
exports.waitUntilBlock = waitUntilBlock;
// intro and disclaimer
function disclaimerIntro(title, description, requiresKey) {
    (0, exports.printDivider)();
    console.log(`${title.toUpperCase()}`);
    console.log(description);
    (0, exports.printDivider)();
    requiresKey && console.log("THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.\n");
    console.log("THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.\n");
    console.log("USE AT YOUR OWN RISK. PLEASE REPORT ANY ISSUES ON GITHUB.");
}
exports.disclaimerIntro = disclaimerIntro;
