import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listModels } from "../server/models";
import { estimateCredits } from "../server/pricing";
import type { ModelType } from "../server/types";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const type = typeof req.query.type === "string" ? (req.query.type as ModelType) : undefined;
  const models = listModels(type).map(({ falEndpoint: _falEndpoint, ...model }) => ({
    ...model,
    credits: estimateCredits({ ...model, falEndpoint: "" })
  }));
  res.status(200).json({ models });
}
