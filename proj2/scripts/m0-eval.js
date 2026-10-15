#!/usr/bin/env node
const path = require('path');
const m0 = require(path.resolve(__dirname, '../../scripts/m0-eval.js'));
if (m0 && typeof m0.runCli === 'function') {
  m0.runCli();
}
