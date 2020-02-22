<template>
  <div id="app">
    <div id="google-topbar">
      <div id="google-signin-btn"></div>
      <button id="google-signout-btn" v-on:click="signOut">
        Sign Out
      </button>
      <div id="google-signed-in-as" v-if="currentUserProfile">
        Signed in as: {{ currentUserProfile.getName() }} ({{
          currentUserProfile.getEmail()
        }})
      </div>
    </div>

    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </div>

    <router-view />

    <div v-if="currentThots">
      <h2>
        Time until next callout: {{ Math.floor(timeUntilNextMs / 1000) }}s
      </h2>
      <h2>Last callout: {{ lastThot }}</h2>
      <table border="1">
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Email</th>
            <th>Thot %</th>
            <th>Thot Count</th>
            <th>Callouts Present For</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="thot in currentThots" :key="thot.email">
            <td><img :src="thot.pictureUrl" /></td>
            <td>{{ thot.name }}</td>
            <td>{{ thot.email }}</td>
            <td>{{ thot.thotPercent.toFixed(2) }}%</td>
            <td>{{ thot.thotCount }}</td>
            <td>{{ thot.presentFor }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import io from "socket.io-client";
import * as CONFIG from "../config";

const backendUrl =
  process.env.NODE_ENV === "production"
    ? CONFIG.server.prodUrl
    : CONFIG.server.devUrl;

export default {
  name: "App",
  data() {
    return {
      backendUrl: backendUrl,
      currentUserProfile: null,
      currentUserIdToken: null,
      currentThots: null,
      socket: null,
      timeOfNext: null,
      timeUntilNextMs: null,
      lastThot: null
    };
  },
  mounted() {
    const vue = this;

    window.gapi.load("auth2", () => {
      window.gapi.auth2.init({ client_id: CONFIG.client_id });
      window.gapi.signin2.render("google-signin-btn", {
        onsuccess: vue.onSignIn
      });
    });

    setInterval(() => {
      if (vue.timeOfNext) {
        const currentDate = new Date();
        const currentTimeUnix = new Date(currentDate.toISOString()).getTime();
        const timeOfNextUnix = new Date(vue.timeOfNext).getTime();

        vue.timeUntilNextMs = timeOfNextUnix - currentTimeUnix;
        const diff = timeOfNextUnix - currentTimeUnix;
        if (diff < 0) {
          vue.timeUntilNextMs = 0;
        } else {
          vue.timeUntilNextMs = diff;
        }
      }
    }, 500);
    this.socket = io(this.backendUrl);
    this.socket.on("thotsUpdated", data => {
      vue.refreshThots();
      if (data) {
        vue.timeOfNext = data.timeOfNext;
        vue.lastThot = data.lastThot;
      }
    });
  },
  methods: {
    onSignIn(googleUser) {
      // Store the current user profile
      this.currentUserProfile = googleUser.getBasicProfile();

      // Send idtoken to back end to verify the user
      this.currentUserIdToken = googleUser.getAuthResponse().id_token;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.backendUrl}/tokensignin`);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.onload = () => {
        this.refreshThots();
      };
      xhr.send("idtoken=" + this.currentUserIdToken);
    },
    signOut() {
      const vue = this;
      const auth2 = window.gapi.auth2.getAuthInstance();
      auth2.signOut().then(() => {
        vue.currentUserProfile = null;
        vue.currentUserIdToken = null;
      });
    },
    refreshThots() {
      const vue = this;
      fetch(`${this.backendUrl}/api/thots`).then(res => {
        if (res.status !== 200) {
          return;
        }

        res.json().then(data => {
          if (data.data) {
            vue.currentThots = data.data;
            vue.currentThots.sort((a, b) =>
              a.thotPercent > b.thotPercent
                ? -1
                : b.thotPercent > a.thotPercent
                ? 1
                : 0
            );
          }
        });
      });
    }
  }
};
</script>
