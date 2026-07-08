<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { 
  Clock, 
  GitPullRequest, 
  GitCommit, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Calendar,
  ExternalLink,
  ChevronRight,
  TrendingDown
} from 'lucide-vue-next'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

const repoId = ref(null)
const decisions = ref([])
const loading = ref(true)
const error = ref(null)
const selectedDecision = ref(null)

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  repoId.value = params.get('repoId')
  
  if (repoId.value) {
    fetchDecisions()
  } else {
    loading.value = false
    error.value = 'No repository ID specified in query parameters.'
  }
})

async function fetchDecisions() {
  loading.value = true
  error.value = null
  try {
    const res = await axios.get(`${BACKEND_URL}/api/repos/${repoId.value}/decisions`)
    decisions.value = res.data
    if (decisions.value.length > 0) {
      selectedDecision.value = decisions.value[0]
    }
  } catch (err) {
    error.value = 'Failed to load timeline decisions: ' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
  }
}

function selectDecision(decision) {
  selectedDecision.value = decision
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 overflow-hidden h-screen">
    
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0">
      <div>
        <h2 class="text-base font-extrabold tracking-wide uppercase text-blue-400">
          Decision Archaeology Timeline
        </h2>
        <p class="text-xs text-slate-400">
          Historical breakdown of architectural and design choices extracted by LangGraph
        </p>
      </div>
      <button 
        @click="fetchDecisions"
        class="bg-slate-900 hover:bg-slate-800 text-xs px-3 py-1.5 rounded border border-slate-800 hover:border-slate-700 transition flex items-center gap-1.5"
      >
        <Clock :size="14" class="text-slate-400" /> Refresh
      </button>
    </div>

    <!-- Error/Loading -->
    <div v-if="loading" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-sm text-slate-400">Analyzing repository timeline...</p>
    </div>

    <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <AlertTriangle class="text-rose-500 w-12 h-12 mb-4 animate-bounce" />
      <p class="text-sm font-semibold text-slate-300">{{ error }}</p>
      <p class="text-xs text-slate-500 mt-2">
        Try running decision extraction on a target file in the Chat tab first to populate this timeline!
      </p>
    </div>

    <div v-else-if="decisions.length === 0" class="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
      <Info class="text-slate-500 w-10 h-10 mb-4" />
      <h3 class="font-bold text-sm text-slate-300">No decisions extracted yet</h3>
      <p class="text-xs text-slate-500 mt-2 leading-relaxed">
        Go to the <strong>Decision Chat</strong>, specify a file path (e.g. <code>src/index.js</code>) on the right sidebar, and click <strong>Extract Decisions</strong> to start archaeology.
      </p>
    </div>

    <!-- Main Workspace Split -->
    <div v-else class="flex-1 flex gap-6 overflow-hidden min-h-0">
      
      <!-- Left Timeline View -->
      <div class="flex-1 overflow-y-auto pr-4 relative">
        <div class="absolute left-6 top-2 bottom-2 w-[2px] bg-slate-800"></div>

        <div class="space-y-6">
          <div 
            v-for="(dec, idx) in decisions" 
            :key="dec._id"
            @click="selectDecision(dec)"
            class="relative pl-14 cursor-pointer group"
          >
            <!-- Timeline Marker dot -->
            <div 
              class="absolute left-4 top-1.5 w-4 h-4 rounded-full border-2 transition duration-300 flex items-center justify-center"
              :class="[
                selectedDecision?._id === dec._id
                  ? 'bg-blue-500 border-blue-400 ring-4 ring-blue-500/20 scale-125'
                  : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'
              ]"
            >
              <div v-if="dec.staleness?.isStale" class="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
            </div>

            <!-- Decision Card -->
            <div 
              class="p-4 rounded-xl border transition-all duration-300 hover:translate-x-1"
              :class="[
                selectedDecision?._id === dec._id
                  ? 'bg-blue-950/15 border-blue-500/60 shadow-lg shadow-blue-500/5'
                  : 'bg-slate-900/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/60'
              ]"
            >
              <div class="flex items-start justify-between gap-3 mb-2">
                <span class="text-xs text-slate-400 font-semibold font-mono tracking-tight bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {{ dec.filePath }}
                </span>
                
                <!-- Staleness Flag -->
                <span 
                  v-if="dec.staleness?.isStale" 
                  class="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold"
                >
                  <TrendingDown :size="10" /> Stale
                </span>
                <span 
                  v-else-if="dec.staleness?.checked" 
                  class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold"
                >
                  <CheckCircle :size="10" /> Validated
                </span>
              </div>

              <h4 class="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors duration-150 mb-3 line-clamp-2">
                {{ dec.summary }}
              </h4>

              <!-- Footer Metadata -->
              <div class="flex items-center gap-4 text-[10px] text-slate-500">
                <span class="flex items-center gap-1">
                  <Calendar :size="12" />
                  {{ formatDate(dec.createdAt) }}
                </span>
                <span v-if="dec.commitSha" class="flex items-center gap-1 font-mono">
                  <GitCommit :size="12" />
                  {{ dec.commitSha.substring(0, 7) }}
                </span>
                <span v-if="dec.prNumber" class="flex items-center gap-1">
                  <GitPullRequest :size="12" />
                  PR #{{ dec.prNumber }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Detail Sidebar Panel -->
      <div v-if="selectedDecision" class="w-96 border-l border-slate-800 bg-slate-900/25 p-5 flex flex-col gap-5 overflow-y-auto shrink-0 min-h-0">
        <div>
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Decision Summary</h3>
          <p class="text-sm leading-relaxed text-slate-200 font-semibold">{{ selectedDecision.summary }}</p>
        </div>

        <div class="border-t border-slate-850 pt-4 flex flex-col gap-2 text-xs">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Context Metadata</span>
          <div class="flex justify-between py-1 border-b border-slate-900">
            <span class="text-slate-500">File Path:</span>
            <span class="font-mono text-slate-300 truncate max-w-[200px]" :title="selectedDecision.filePath">{{ selectedDecision.filePath }}</span>
          </div>
          <div v-if="selectedDecision.functionName" class="flex justify-between py-1 border-b border-slate-900">
            <span class="text-slate-500">Function:</span>
            <span class="font-mono text-slate-300">{{ selectedDecision.functionName }}</span>
          </div>
          <div v-if="selectedDecision.commitSha" class="flex justify-between py-1 border-b border-slate-900">
            <span class="text-slate-500">Commit SHA:</span>
            <span class="font-mono text-blue-400 flex items-center gap-1">
              {{ selectedDecision.commitSha.substring(0, 12) }}
            </span>
          </div>
          <div v-if="selectedDecision.prNumber" class="flex justify-between py-1">
            <span class="text-slate-500">PR Number:</span>
            <span class="font-semibold text-blue-400">#{{ selectedDecision.prNumber }}</span>
          </div>
        </div>

        <!-- Verification / Staleness Block -->
        <div class="border-t border-slate-850 pt-4">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Staleness Verification</h3>
          
          <div 
            v-if="selectedDecision.staleness?.isStale"
            class="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300"
          >
            <div class="flex items-center gap-2 mb-2 font-bold text-xs">
              <AlertTriangle :size="14" class="text-rose-400 shrink-0" />
              <span>DECISION PREMISE DEPRECATED</span>
            </div>
            <p class="text-xs leading-relaxed">{{ selectedDecision.staleness.reason }}</p>
          </div>

          <div 
            v-else-if="selectedDecision.staleness?.checked"
            class="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
          >
            <div class="flex items-center gap-2 mb-1.5 font-bold text-xs">
              <CheckCircle :size="14" class="text-emerald-400 shrink-0" />
              <span>PREMISE STILL VALID</span>
            </div>
            <p class="text-xs leading-relaxed" v-if="selectedDecision.staleness.reason">
              {{ selectedDecision.staleness.reason }}
            </p>
            <p class="text-[10px] text-slate-500" v-else>
              LLM verification confirms no succeeding modifications have undone this architectural choice.
            </p>
          </div>

          <div 
            v-else
            class="p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs italic"
          >
            Not yet verified for staleness.
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Transition custom animations */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;  
  overflow: hidden;
}
</style>
