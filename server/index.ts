import "./load-env";
import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`API http://127.0.0.1:${PORT}（本机） 局域网可访问 ${HOST}:${PORT}`);
});
