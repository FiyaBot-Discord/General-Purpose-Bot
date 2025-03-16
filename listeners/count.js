const { Listener } = require("gcommands");
const config = require("../config.json");
const CountStateSchema = require("../schemas/countStateSchema");
const CountUserSchema = require("../schemas/countUserSchema");

new Listener({
  name: "Counting Game",
  event: "messageCreate",

  run: async (ctx) => {
    // Ignore messages from bots
    if (ctx.author.bot) return;

    // Only process messages in the designated counting channel
    if (ctx.channel.id !== config.discord.countChannelId) return;

    const content = ctx.content.trim();
    if (isNaN(content)) {
      await ctx.delete();
      return;
    }

    const userNumber = parseInt(content, 10);

    try {
      // Fetch or create the global count document
      let countDoc = await CountStateSchema.findById("config");
      if (!countDoc) {
        countDoc = new CountStateSchema({
          _id: "config",
          currentCount: 0,
          currentCountAuthorId: "",
        });
        await countDoc.save();
      }

      // Prevent one person from counting twice in a row
      if (ctx.author.id === countDoc.currentCountAuthorId) {
        await ctx.delete();
        return;
      }

      // Determine the expected next number
      const nextNumber = countDoc.currentCount + 1;

      if (userNumber === nextNumber) {
        // Fetch or create the user's count document
        let countUserDoc = await CountUserSchema.findById(ctx.author.id);
        if (!countUserDoc) {
          countUserDoc = new CountUserSchema({
            _id: ctx.author.id,
            displayName: ctx.member.displayName,
            totalCounts: 0,
          });
        }

        // Update the global count document
        countDoc.currentCount = nextNumber;
        countDoc.currentCountAuthorId = ctx.author.id;
        await countDoc.save();

        // Update the user's count
        countUserDoc.displayName = ctx.member.displayName;
        countUserDoc.totalCounts += 1;
        await countUserDoc.save();

        // Delete the user's original message
        await ctx.delete();

        // Fetch or create a webhook to re-send the count
        let webhooks = await ctx.channel.fetchWebhooks();
        let countingWebhook = webhooks.find(
          (wh) => wh.name === "CountingWebhook"
        );

        if (!countingWebhook) {
          countingWebhook = await ctx.channel.createWebhook({
            name: "CountingWebhook",
            avatar: ctx.author.displayAvatarURL({ dynamic: true }),
          });
        }

        // Send the new count via the webhook to mimic the user
        await countingWebhook.send({
          content: content,
          username: ctx.member.displayName,
          avatarURL: ctx.author.displayAvatarURL({ dynamic: true }),
        });
      } else {
        // If the message isn't the correct next number, delete it.
        await ctx.delete();
      }
    } catch (error) {
      console.error(error);
    }
  },
});
