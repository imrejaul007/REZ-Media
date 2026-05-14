"use strict";
/**
 * @deprecated Use @rez/shared utilities instead.
 * This file re-exports from @rez/shared for backward compatibility.
 *
 * Migration:
 *   Before: import { logger } from './utils/logger';
 *   After:  import { logger } from '@rez/shared';
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceLogger = exports.logger = void 0;
var shared_1 = require("@rez/shared");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return shared_1.logger; } });
Object.defineProperty(exports, "createServiceLogger", { enumerable: true, get: function () { return shared_1.createServiceLogger; } });
//# sourceMappingURL=logger.js.map