import { FastifyInstance } from "fastify";
import { knex } from "../database";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { checkSessionIdExists } from "../middlewares/check-session-id-extists";

export async function transactionsRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [checkSessionIdExists],
    },
    async (req, res) => {
      const { sessionId } = req.cookies;

      const transactions = await knex("transactions")
        .where("session_id", sessionId)
        .select();

      return { transactions };
    }
  );

  app.get(
    "/:id",
    {
      preHandler: [checkSessionIdExists],
    },
    async (req) => {
      const { sessionId } = req.cookies;
      const getTransactionParamsSchema = z.object({
        id: z.string().uuid(),
      });

      const { id } = getTransactionParamsSchema.parse(req.params);
      const transaction = await knex("transactions")
        .where({
          session_id: sessionId,
          id,
        })
        .first();

      return { transaction };
    }
  );

  app.get(
    "/summary",
    {
      preHandler: [checkSessionIdExists],
    },
    async (req) => {
      const { sessionId } = req.cookies;
      const summary = await knex("transactions")
        .where("session_id", sessionId)
        .sum("amount", { as: "amount" })
        .first();

      return { summary };
    }
  );

  app.post("/", async (req, res) => {
    const createTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(["credit", "debit"]),
    });

    const { title, amount, type } = createTransactionBodySchema.parse(req.body);

    let sessionId = req.cookies.sessionId;

    if (!sessionId) {
      sessionId = randomUUID();

      res.cookie("sessionId", sessionId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, //7 days
      });
    }

    const parsedAmount = () => {
      if (type === "debit") return amount * -1;
      return amount;
    };

    await knex("transactions").insert({
      id: randomUUID(),
      title,
      amount: parsedAmount(),
      session_id: sessionId,
    });

    return res.status(201).send();
  });
}
