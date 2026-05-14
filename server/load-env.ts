import dotenv from "dotenv";
import path from "path";
import { ROOT } from "./paths.js";

dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });
