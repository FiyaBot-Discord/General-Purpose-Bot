// Command to stop member of the week tournament. It sends leaderboard of the tournament and then deletes all the mowPoints and vote status from the database

const { Command, CommandType, MessageEmbed } = require("gcommands");
const xpUser = require("../../schemas/xpUser");
const { PermissionFlagsBits } = require("discord.js");
const mowTournamentStatus = require("../../utils/mowTournamentStatus");
const xpConfig = require("../../schemas/xpConfig");
const config = require("../../config.json");

new Command({
  name: "stopmow",
  description: "Stops the member of the week tournament",
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  type: [CommandType.SLASH],
  run: async (ctx) => {
    try {
      await ctx.deferReply();

      console.log(await mowTournamentStatus());
      if ((await mowTournamentStatus()) === false) {
        return ctx.editReply({
          content: "Member of the week tournament has not started yet",
        });
      }

      // Get all users sorted by mowPoints in descending order
      const users = await xpUser
        .find({ mowPoints: { $exists: true } })
        .sort({ mowPoints: -1 });

      // Create an embed to send the leaderboard
      const embed = new MessageEmbed()
        .setTitle("Member of the Week Leaderboard")
        .setColor(config.colors.primary)
        .setTimestamp();

      if (!users.length) {
        embed.setDescription("Nothing to show here yet!");
      }

      // Add the top 10 users to the embed
      for (let index = 0; index < users.length; index++) {
        const user = users[index];
        if (index < 10) {
          embed.addFields({
            name: `${index + 1}. ${user.displayName}`,
            value: `${user.mowPoints.toFixed(2)} points`,
          });
        }
      }

      // Send the embed
      await ctx.editReply({ embeds: [embed] });
      // Go through each user and delete their mowPoints and voted fields if exist
      await xpUser
        .updateMany(
          {},
          {
            $unset: {
              mowPoints: "",
              votesLeft: "",
              votes: "",
              votedMembers: "",
            },
          }
        )
        .then(() => {
          console.log("Fields removed from all users successfully");
        })
        .catch((err) => {
          console.error(err);
          return ctx.channel.send({
            content:
              "An error occurred while trying to stop the member of the week tournament",
          });
        });

      const xpConfigDoc = await xpConfig.findById("config");
      if (xpConfigDoc) {
        xpConfigDoc.mowTournamentStatus = false;
        await xpConfigDoc.save();
      } else {
        await xpConfig.create({ _id: "config", mowTournamentStatus: false });
      }

      return ctx.channel.send({
        content: "Member of the week tournament has stopped",
      });
    } catch (err) {
      console.error(err);
      return ctx.channel.send({
        content:
          "An error occurred while trying to stop the member of the week tournament",
      });
    }
  },
});
