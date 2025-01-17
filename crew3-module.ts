import * as dotenv from "dotenv";
import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import delay from "delay";
import { faker } from "@faker-js/faker";
import { Twitter } from "./twitter-module";

dotenv.config();

const TWITTER_PHRASES = [
  "great milestone team ❤️🌎",
  "👍👍👍👍",
  "👏",
  "We need more of this kind of good news 🚀",
  "Nice",
  "Good",
  "go moon",
  "Great news 😊",
  "Great project",
  "awesome",
  "Nice project",
  "Good news!",
  "Very good",
  "👌",
  "🚀🚀🚀",
  "amazing",
  "Cool!",
];

// Helpers
export const randomInt = (value) => Math.floor(Math.random() * value);
export const sleep = async (value) => delay(value + randomInt(value));

export const shuffle = (array) =>
  array.sort(() => (Math.random() > 0.5 ? 1 : -1));

// Crew Module
export class CrewProfile {
  instantiatedAt = new Date();
  crew3: AxiosInstance;
  headers;

  constructor(headers, httpProxyAgent = null) {
    headers.origin = "https://crew3.xyz";
    this.headers = headers;
    this.crew3 = axios.create({
      baseURL: "https://api.crew3.xyz/",
      headers: this.headers,
      httpAgent: httpProxyAgent,
    });
    console.log(`New Crew3 profile constructed`);
  }

  /**
   * @returns User main profile data or false
   */
  getUser = async () =>
    await this.crew3
      .get("users/me")
      .then((r) => r.data)
      .catch((e) => {
        console.log("User not connected to Crew3", e?.response?.data);
        return false;
      });

  /**
   * @returns All user joined communities
   */
  getUserCommunities = async () =>
    await this.crew3
      .get("users/me/communities?page=0&limit=60")
      .then((r) => r.data.communities)
      .catch((e) => {
        console.log("User not connected to Crew3", e?.response?.data);
        return [];
      });

  /**
   * @param subdomain subdomain name from url or API
   * @returns invite url for given subdomain
   */
  getReferralLink = async (subdomain: string) =>
    await this.crew3
      .get(`communities/${subdomain}/users/me/referral-link`)
      .then((r) => `https://${subdomain}.crew3.xyz/invite/${r.data.id}`)
      .catch((e) => `https://${subdomain}.crew3.xyz`);

  /**
   * @param subdomain of community
   * @param invite code from link
   * @returns invite url for given subdomain
   */
  joinByReferral = (subdomain: string, invite: string) => {
    return axios
      .get(`https://${subdomain}.crew3.xyz/invite/${invite}`, {
        headers: this.headers,
      })
      .then(async (r) =>
        this.crew3
          .post(
            "users/me/accept-invitation",
            { invitationId: invite },
            this.getHeaders(subdomain)
          )
          .then((r) => {
            return `Successfully joined to community!`;
          })
      )
      .catch((e) => {
        return e?.response?.data?.message || `Wrong invite link`;
      });
  };

  /**
   * @param subdomain of community
   * @param email of user
   * @returns mail status
   */
  sendMagicLink = (subdomain: string, email: string) => {
    return this.crew3
      .post(
        "authentification/email/magic-link",
        {
          email: email,
          subdomain: subdomain,
        },
        this.getHeaders(subdomain)
      )
      .then((r) => {
        return `Successfully joined to community!`;
      });
  };

  /**
   * Parse pages with Crew3 communities
   * @param type 'all', 'new', 'hot'
   * @param to end page
   * @param from start page
   * @param timeout sleep time between parsing
   * @returns array of communities
   */
  getCommunities = async (type = "new", to = 5, from = 0, timeout = 2000) => {
    let communities = [];
    for (let i = from; i < to; i++) {
      console.log(`Parse ${type} page ${i} ...`);
      const page = (
        await this.crew3.get(`communities?page=${i}&category=${type}`)
      ).data.communities;
      if (page.length > 0) communities = [...communities, ...page];
      else break;
      await sleep(timeout);
    }
    console.log(`Find ${communities.length} ${type} communities...`);
    return communities;
  };

  /**
   * Join Crew3 communities
   * @param communities array of communities
   * @param timeout to avoid account ban
   * @returns array of communities
   */
  joinCommunities = async (communities, timeout = 2000) => {
    const report = [`Start join to ${communities.length} communities:`];
    for (const community of communities) {
      if (community.visibility !== "private") {
        const res = await this.joinCommunity(community.subdomain);
        if (res)
          report.push(
            `Community ${community.name} was joined successfully ✅.`
          );
        else report.push(`Couldn't join ${community.name} ❌.`);
      } else
        report.push(`${community.name} is private! Can't subscribe to it.`);
      await sleep(timeout);
    }
    return report;
  };

  /**
   * @returns Get user community stats
   */
  getUserCommunityStats = async (community, user) =>
    await this.crew3
      .get(`communities/${community?.subdomain || community}/users/${user.id}`)
      .then((r) => r.data)
      .catch((e) => {
        console.log("Data from community unavailiable", e?.response?.data);
        return {};
      });
  /**
   * Notify message for telegram bot
   * @param community from API
   * @param user from API
   * @returns array of communities
   */
  communityMessage = async (community, user = null) => {
    const stats = user
      ? await this.getUserCommunityStats(community, user)
      : null;
    return `*${community.name}*${
      community.description ? `\n\n${community.description}` : ""
    }

*Crew3:* [https://${community.subdomain}.crew3.xyz](https://${
      community.subdomain
    }.crew3.xyz)
*Discord:* [${community.discord}](${community.discord || "NONE"})
*Twitter:* [https://twitter.com/${community.twitter}](https://twitter.com/${
      community.twitter
    })
*Opensea:* [${community.opensea}](${community.opensea || "NONE"})

Blockchain: *${community.blockchain.toUpperCase()}*
${community.sector ? `Sector: *${community.sector.toUpperCase()}*` : ""}

Community rank: *${community.rank}*
Quests: *${community.quests}*
Required: *${Object.entries(community.requiredFields)
      .filter(([key, value]) => value)
      .map(([key, value]) => `${key.replace("fill", "").replace("link", "")}`)
      .join(", ")}*
${
  stats
    ? `
Invites: *${stats.invites}* | Level: *${stats.level}*
Leaderboard rank: *${stats.rank}*
Claimed XP: *${stats.xp}*`
    : ""
}
`;
  };

  /**
   * Join single community without invite link
   * @param subdomain from API
   * @returns array of communities
   */
  joinCommunity = async (subdomain) =>
    this.crew3
      .post(`communities/${subdomain}/members`)
      .then(async (r) => true)
      .catch((e) => {
        console.log(e);
        return false;
      });

  /**
   * Search get community by subdomain
   * @param subdomain from API
   * @returns object
   */
  getCommunity = async (subdomain) =>
    this.crew3
      .get(`communities/${subdomain}`)
      .then((r) => r.data)
      .catch((e) => {
        console.log(e);
        return false;
      });

  /**
   * Search first community matched keyword
   * @param keyword for search
   * @returns array of communities
   */
  searchCommunity = async (keyword) =>
    this.crew3
      .get(
        `communities?${new URLSearchParams({
          search: keyword,
        }).toString()}&limit=10`
      )
      .then((r) => r.data.communities[0])
      .catch((e) => {
        console.log(e);
        return false;
      });

  /**
   * Replace headers for community requests
   * @param subdomain from API
   * @returns array of communities
   */
  getHeaders = (subdomain) => ({
    headers: {
      origin: `https://${subdomain}.crew3.xyz`,
      referer: `https://${subdomain}.crew3.xyz`,
      cookie: this?.headers?.cookie?.replace("root", subdomain),
    },
  });

  /**
   * Replace headers for claim requests by community
   * @param subdomain from API
   * @returns array of communities
   */
  getClaimHeaders = (subdomain) =>
    Object.assign(
      {
        "content-type": `multipart/form-data;`,
      },
      this.getHeaders(subdomain)
    );

  /**
   * Leave community
   * @param subdomain from API
   * @returns array of communities
   */
  leaveCommunity = async (community, user) =>
    this.crew3
      .delete(
        `communities/${
          community.subdomain ? community.subdomain : community
        }/members/${user.id}`
      )
      .then(() => "success")
      .catch((e) => e?.response?.data?.message || `error`);

  /**
   * Leave list of communities
   * @param communities from API
   * @param user from API
   * @param timeout to avoid account ban
   * @returns true after processing
   */
  leaveCommunities = async (communities, user, timeout = 1000) => {
    for (const community of communities) {
      await this.leaveCommunity(community, user);
      await sleep(timeout);
    }
    return true;
  };

  /**
   * Get Claimed answers of community
   * @param community from API
   * @param page
   * @param pageSize
   * @returns true after processing
   */
  getCommunityAnswers = (community, page = 0, pageSize = 10) => {
    return this.crew3
      .get(
        `communities/${community.subdomain}/users/me/notifications?page=${page}&page_size=${pageSize}`
      )
      .then((r) => {
        const answers = r.data.notifications.filter(
          (note) =>
            note.status === "success" &&
            note.type === "claim" &&
            ["quiz", "text"].includes(note.events[0].valueType)
        );
        return {
          community: community.name.replace(/[^a-zA-Z0-9 ]/, ""),
          answers: answers.map((answer) => ({
            question: answer.title.trim(),
            answer: answer.events[0].value,
          })),
        };
      })
      .catch((e) => e?.response?.data?.message || `error`);
  };

  /**
   * Get community quests by themes
   * @param subdomain from API
   * @returns array of communities
   */
  getQuests = async (subdomain) =>
    this.crew3
      .get(`communities/${subdomain}/questboard`, this.getHeaders(subdomain))
      .then((r) => {
        return r.data.filter((quests) => !quests.deleted);
      })
      .catch((e) => {
        console.log(subdomain + " is private!");
        return [];
      });

  /**
   * Get all community quests
   * @param subdomain from API
   * @returns array of quests
   */
  getAllQuests = async (subdomain) => {
    const quests = [];
    for (const theme of await this.getQuests(subdomain))
      for (const quest of theme.quests) quests.push(quest);
    return quests;
  };

  // Get unlocked and available quests
  getUnlockedQuests = (quests) =>
    quests.filter((item) => item.unlocked && !item.inReview && item.open);

  getQuestsToClaim = async (subdomain, types) => {
    const all = await this.getAllQuests(subdomain);
    const unlocked = this.getUnlockedQuests(all);
    return unlocked.filter((item) =>
        types.includes(item.submissionType)
    );
  };

  // Get invites quests
  getInvitesQuests = (quests) =>
    quests.filter((item) => item.submissionType === "invites");

  // Get quests which can give role
  getRoleQuests = (quests) =>
    quests.filter(
      (item) =>
        item?.reward[0]?.type === "role" || item?.reward[1]?.type === "role"
    );

  // Get autovalidate quests
  getAutoValidateQuests = (quests) =>
    quests.filter((item) => item.autoValidate);

  // Get twitters quests
  getTwitterQuests = (quests) =>
    quests.filter((item) => item.submissionType === "twitter");

  /**
   * Get twitter tasks for quest
   * @param quest from API
   * @returns array of pairs { task, link }
   */
  getTwitterTasksForQuest = async (quest) => {
    const actions = [];
    const tasks = quest.validationData;
    if (tasks.actions.includes("follow"))
      actions.push({
        task: "follow",
        link: `https://twitter.com/intent/user?screen_name=${tasks.twitterHandle}`,
      });
    if (tasks.actions.includes("like"))
      actions.push({
        task: "like",
        link: `https://twitter.com/intent/like?tweet_id=${tasks.tweetId}`,
      });
    if (tasks.actions.includes("retweet"))
      actions.push({
        task: "retweet",
        link: `https://twitter.com/intent/retweet?tweet_id=${tasks.tweetId}`,
      });
    if (tasks.actions.includes("reply"))
      actions.push({
        task: "reply",
        link: `https://twitter.com/intent/tweet?in_reply_to=${
          tasks.tweetId
        }&text=${
          tasks.defaultReply
            ? `${encodeURIComponent(tasks.defaultReply)}`
            : encodeURIComponent(
                TWITTER_PHRASES[randomInt(TWITTER_PHRASES.length)]
              )
        }`,
      });
    if (tasks.actions.includes("tweet"))
      actions.push({
        task: "tweet",
        link: `https://twitter.com/intent/tweet?&text=${encodeURIComponent(
          tasks.defaultTweet + " " + tasks.tweetWords.join(" ")
        )}`,
      });
    return [...new Set(actions)];
  };

  // Get discord quests
  getDiscordQuests = (quests) =>
    quests.filter((item) => item.submissionType === "discord");

  /**
   * Get discord task for community
   * @param quests list from API
   * @returns array of links to join
   */
  getDiscordTasksForQuests = (quests) => {
    const discordTasks = [];
    const discordQuests = this.getDiscordQuests(quests);
    for (const quest of discordQuests) {
      const tasks = quest.validationData;
      if (quest.validationData.inviteLink) {
        discordTasks.push(`${tasks.inviteLink}`);
      }
    }
    return [...new Set(discordTasks)];
  };

  /**
   * Get quests for communities by submission type
   * @param communities list from API
   * @returns array of links to join
   */
  getQuestsByType = async (communities, types) => {
    let quests = [];
    for (const community of communities) {
      const all = await this.getAllQuests(community.subdomain);
      const unlocked = this.getUnlockedQuests(all);
      quests = [
        ...quests,
        ...unlocked.filter((item) => types.includes(item.submissionType)),
      ];
      console.log(quests);
    }
    return [...new Set(quests)];
  };

  /**
   * Get twitter tasks for communities
   * @param communities list from API
   * @returns array of links to join
   */
  getDiscordTasksForCommunities = async (communities) => {
    const report = [
      `Start collecting Discord quests for ${communities.length} communities:`,
    ];
    for (const community of communities) {
      const all = await this.getAllQuests(community.subdomain);
      const unlocked = this.getUnlockedQuests(all);
      const quests = unlocked.filter((item) =>
        ["discord"].includes(item.submissionType)
      );
      console.log(quests);
    }
    return report;
  };

  getTextFromQuestDescription = (x) => {
    if (x.content)
      return x.content
        .map((x) =>
          x.type === "text" ? x.text : this.getTextFromQuestDescription(x)
        )
        .flat()
        .join("");
    else {
      return "";
    }
  };

  /**
   * Get quest display text
   * @param quest from API
   * @returns string
   */
  getQuestDisplayText = (quest) => {
    return `Name: *${quest.name}*
Description:
_${this.getTextFromQuestDescription(quest.description)}_
Claim reward [here](https://crew3.xyz/c/mantle/questboard/${quest.id})
`;
  };

  /**
   * Claim quest for subdomain
   * @param subdomain from API
   * @param quest from API
   * @param answer from answers list, necessary for text/quiz/url/image types of quests
   * @param twitterUserHandle from user context
   * @returns boolean
   */
  claimQuest = async (subdomain, quest, answer, twitterUserHandle) => {
    console.log(
      `\nTry to claim ${subdomain} community quest,\nType: ${
        quest.submissionType
      },\nName: ${quest.name}${answer ? `\nAnswer: ${answer}` : ""}`
    );
    const data = new FormData();
    if (answer && answer.length > 0) data.append("value", answer);
    else if (["quiz", "text", "url", "image"].includes(quest.submissionType)) {
      return `${this.getQuestDisplayText(quest)}
requires answer:
${JSON.stringify(quest.validationData)}`;
    }

    if (quest.submissionType === "twitter") {
      const twitter = new Twitter();
      const actions = quest.validationData.actions;
      const tweetId = quest.validationData.tweetId;

      if (actions.includes("follow")) {
        await twitter.follow(quest.validationData.twitterHandle);
      }

      if (actions.includes("tweet")) {
        let tweetText = TWITTER_PHRASES[randomInt(TWITTER_PHRASES.length)];
        if (quest.validationData.tweetWords) {
          tweetText += `\n${quest.validationData.tweetWords.join(" ")}`;
        }
        try {
          const res = await twitter.tweet(tweetText);
          data.append(
            "value",
            `https://twitter.com/${twitterUserHandle}/status/${res.id_str}`
          );
        } catch (e) {
          if (e.data.errors[0].code === 187) {
            console.log("Tweet is a duplicate, still want to claim quest.");
          } else if (e.data.errors[0].code === 185) {
            return `Cannot tweet anymore today (user is over daily status update limit).`;
          } else {
            throw e;
          }
        }
      }

      if (tweetId && actions.includes("reply")) {
        const tweetText =
          quest.validationData.defaultReply ||
          TWITTER_PHRASES[randomInt(TWITTER_PHRASES.length)];
        try {
          await twitter.reply(tweetText, tweetId);
        } catch (e) {
          if (e.data.errors[0].code === 187) {
            console.log("Tweet is a duplicate, still want to claim quest.");
          } else if (e.data.errors[0].code === 385) {
            return `Tweet has been deleted, cannot reply. Quest not claimable.`;
          } else if (e.data.errors[0].code === 185) {
            return `Cannot tweet anymore today (user is over daily status update limit).`;
          } else {
            throw e;
          }
        }
      }

      if (tweetId && actions.includes("like")) {
        try {
          await twitter.client.v1.post("favorites/create.json", {
            id: tweetId,
          });
        } catch (e) {
          if (e.data.errors[0].code === 139) {
            console.log(
              "Tweet has already been liked, still want to claim quest."
            );
          } else if (e.data.errors[0].code === 144) {
            return `Tweet is not found, cannot like. Quest not claimable.`;
          } else {
            throw e;
          }
        }
      }

      if (tweetId && actions.includes("retweet")) {
        try {
          await twitter.client.v1.post(`statuses/retweet/${tweetId}.json`);
        } catch (e) {
          if (e.data.errors[0].code === 327) {
            console.log(
              "Tweet has already been retweeted, still want to claim quest."
            );
          } else if (e.data.errors[0].code === 328) {
            return `Retweet is not possible for this tweet. Quest not claimable`;
          } else {
            throw e;
          }
        }
      }
    }

    data.append("questId", quest.id);
    data.append("type", quest.submissionType);
    data.append(
      "token",
      "03AIIukzihdCbeBYOTilKEJhVc5vbbPPVmhZiHnMEaP00-xb22Ze9ld8R2lQiLEOYOcpIHIYVwbCvW1iPd4YkQcW2njEkT1EZfRi9rKAjz17hwVMYuYZeQvnBrPwMOz1XcIH2u3etW67yH6wUoXq4hpmbJdSEXKokz_tRMeOmScNCaQ7Pwp70yuMj8x0jPiBmkmSnjAmttyEZKN7I7DJcJUwW53v9Vkvne1YlwcpMQ2TOC2RJwTsSpr-gbgWcQXsjinq-81z7JFBv-Pi-iOgk5k416-CYBWkoFjqhk2kHHKkDwwiaZFHpA7SAAIvzKeZubg0gPeAOh_7K0CZPPO3jJojOUU1Iyoj-803vIzHMiuvxz-5LY2a_M2OH7RaKmCnAtFmAMKWiVho_jeTjaBEOUYpLmb1sA-ek6mqq0QT7R1-S-lknxP5uRipYGVkeBXRH6SxBijJ27rFgjPSgzjBAZERj5xB6aUnfw33ATWYK5jO_Q5e9nVUIkJVoReJQxKqwpGQKUpt_xsC3p"
    );
    return await this.crew3
      .post(
        `communities/${subdomain}/quests/${quest.id}/claim`,
        data,
        this.getHeaders(subdomain)
      )
      .then((r) => {
        console.log(`Claim status - ${r.data.status}`);
        if (r.data.status === "success")
          return `Claim *${quest.name}*, earn *${r.data.xp}* points`;
        return `${quest.name} already claimed!`;
      })
      .catch(async (e) => {
        if (
          e?.response?.data?.error?.follow &&
          e?.response?.data?.error?.follow.includes("too many request")
        ) {
          console.error(e?.response?.data?.error?.follow);
          const minutesToWait = parseInt(
            e?.response?.data?.error?.follow.match(
              /too many request, retry in ([0-9]+) minute/
            )[1]
          );
          await sleep(minutesToWait * 60 * 1000);
        }

        if (e?.response?.data?.message) {
          return e?.response?.data?.message;
        } else if (e?.response?.data?.error) {
          console.log(e?.response?.data?.error);
          return (
            e?.response?.data?.error.message ||
            e?.response?.data?.error?.follow ||
            e?.response?.data?.error?.retweet ||
            e?.response?.data?.error?.reply ||
            e?.response?.data?.error?.like
          );
        } else {
          console.log(e);
        }
        return `Something wrong with ${quest.name}`;
      });
  };

  /**
   * Change user settings
   * @param user - user data
   * @param subdomain - community subdomain
   * @param address - new ETH address
   * @param blockchain - new blockchain address
   * @param username - new username
   * @returns boolean
   */
  changeSettings = async (
    subdomain,
    address = null,
    blockchain = "etherium",
    username = null
  ) => {
    console.log(
      `\nTry to change settings ${subdomain}, ${address}, ${blockchain}, ${username}`
    );
    const data = new FormData();

    if (address) {
      data.append("address", address);
      data.append("blockchain", blockchain);
    } else {
      data.append("username", username || faker.internet.userName());
      data.append("displayedInformation", '["discord", "twitter"]');
    }
    return await this.crew3
      .patch(`users/me`, data, this.getHeaders(subdomain))
      .then((r) => {
        console.log(`New User data - ${r.data.name}`);
        return r.data;
      })
      .catch(async (e) => {
        if (e?.response?.data?.message) {
          return e?.response?.data?.message;
        } else if (e?.response?.data?.error) {
          console.log(e?.response?.data);
          return (
            e?.response?.data?.error.message ||
            e?.response?.data?.error?.follow ||
            e?.response?.data?.error?.retweet ||
            e?.response?.data?.error?.reply ||
            e?.response?.data?.error?.like
          );
        } else {
          console.log(e);
        }
        console.log(`Something wrong with changing ${subdomain}`);
        return null;
      });
  };

  /**
   * Claim all quests by type
   * @param communities from API
   * @param answers form answers list, necessary for text/quiz/url/image types of quests
   * @param timeout to avoid account ban
   * @returns array of logs
   */
  claimQuestsForUser = async (
    communities,
    types = ["none"],
    timeout = 2000,
    answers,
    user
  ) => {
    const report = [
      `Start claim *${types.join(", ")}* quests for ${
        communities.length
      } communities:`,
    ];
    for (const community of shuffle(communities)) {
      report.concat(
        await this.claimQuestsByCommunity(
          community,
          types,
          timeout,
          answers,
          user
        )
      );
    }
    console.log(report);
    return report;
  };

  /**
   * Claim all quests by subdomain
   * @param community from API
   * @param answers form answers list, necessary for text/quiz/url/image types of quests
   * @param types
   * @param timeout to avoid account ban
   * @returns array of logs
   */
  claimQuestsByCommunity = async (
    community,
    types = ["none"],
    timeout = 2000,
    answers,
    user
  ) => {
    const report = [
      `Start claim *${types.join(", ")}* quests for community *${
        community.name
      }*:`,
    ];
    const questsToClaim = await this.getQuestsToClaim(community.subdomain, types);
    const communityName = community.name.replace(/[^a-zA-Z0-9 ]/, "");
    if (questsToClaim.length > 0)
      report.push(
        `*${community.name}* \`${community.subdomain}\` (${questsToClaim.length} quests):`
      );
    const communityAnswers = answers[communityName];
    while (questsToClaim.length > 0) {
      const quest = questsToClaim.pop();
      let answer;
      if (communityAnswers) {
        answer = communityAnswers[quest.name.trim()];
      }
      if (
        ["quiz", "text", "url", "image"].includes(quest.submissionType) &&
        !answer
      ) {
        report.push(
          ` - Answer not found for following quest:\n${this.getQuestDisplayText(
            quest
          )}`
        );
      }
      report.push(
        " - " +
          (await this.claimQuest(
            community.subdomain,
            quest,
            answer,
            user.twitterUsername
          ))
      );
      if (questsToClaim.length === 0) {
        await sleep(timeout);
        const newQuests = await this.getQuestsToClaim(community.subdomain, types);
        questsToClaim.concat(newQuests);
      }
    }
    await sleep(timeout);
    console.log(report);
    return report.length > 1
      ? report
      : [
          `No claimable quests with type *"${types.join(
            ","
          )}"* for community *${community.name}*!`,
        ];
  };
}
