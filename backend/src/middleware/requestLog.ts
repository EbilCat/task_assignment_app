import type { Request, Response, NextFunction } from "express";

export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();
  // "finish" fires after the response has been sent, whatever route handled it
  res.on("finish", () => {
    const ms = (performance.now() - start).toFixed(1);
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms} ms)`);
  });
  next();
}
