<template>
  <div class="app">
    <h1>Webpack Example</h1>
    <p>This is a Webpack project using vite-plugin-dev-proxy</p>
    <div class="info">
      <h2>Plugin Configuration:</h2>
      <ul>
        <li>Target: example.com</li>
        <li>HTTPS: true</li>
        <li>Static Prefix: /dev/static</li>
        <li>Entry: /src/main.js</li>
      </ul>
    </div>
    <div class="demo">
      <button @click="fetchData">Fetch Data</button>
      <p v-if="loading">Loading...</p>
      <p v-if="data">{{ data }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      loading: false,
      data: ''
    }
  },
  methods: {
    async fetchData() {
      this.loading = true
      try {
        const response = await fetch('/api/data')
        const result = await response.json()
        this.data = JSON.stringify(result, null, 2)
      } catch (error) {
        this.data = 'Error: ' + error.message
      }
      this.loading = false
    }
  }
}
</script>

<style scoped>
.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: Arial, sans-serif;
}

h1 {
  color: #42b883;
}

.info {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.demo {
  margin: 2rem 0;
}

button {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #35a372;
}
</style>
