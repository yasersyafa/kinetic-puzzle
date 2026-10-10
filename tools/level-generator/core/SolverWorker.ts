import { parentPort, workerData } from 'node:worker_threads';
import { solve } from './SolverV2';
parentPort!.postMessage(solve(workerData.level,workerData.options));
