<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { 
  Clock, 
  GitPullRequest, 
  GitCommit, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Calendar,
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
  <div class="min-h-screen bg-soil text-parchment flex flex-col p-6 overflow-hidden h-screen relative select-none">
    <!-- Texture Overlay -->
    <div class="absolute inset-0 bg-repeat bg-[radial-gradient(#1D1A16_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
    
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 shrink-0 relative z-10">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-ochre p-0.5 shadow-lg shadow-ochre/10 shrink-0">
          <svg class="w-full h-full rounded-md" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="14" fill="#E5A853"/>
            <rect x="4" y="4" width="56" height="56" rx="11" fill="#1D1A16"/>
            <path d="M12 18H52" stroke="#E5A853" stroke-width="6" stroke-linecap="round"/>
            <path d="M12 32H52" stroke="#F5F0E6" stroke-width="6" stroke-linecap="round"/>
            <path d="M12 46H52" stroke="#3AAFA9" stroke-width="6" stroke-linecap="round"/>
            <path d="M32 20L43 32L32 44L21 32Z" fill="#E5A853" stroke="#1D1A16" stroke-width="3"/>
            <circle cx="32" cy="32" r="3" fill="#1D1A16"/>
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg tracking-widest font-black uppercase text-ochre">
            Decision Archaeology Timeline
          </h2>
          <p class="text-xs text-parchment/65 font-sans mt-0.5">
            Historical breakdown of architectural and design choices extracted by LangGraph
          </p>
        </div>
      </div>
      <button 
        @click="fetchDecisions"
        class="bg-surface hover:bg-ochre/10 text-xs text-ochre hover:text-parchment px-3 py-1.5 rounded border border-ochre/25 hover:border-ochre transition flex items-center gap-1.5 cursor-pointer shadow-md font-mono uppercase"
      >
        <Clock :size="13" class="text-ochre/75" /> Refresh
      </button>
    </div>

    <!-- Error/Loading -->
    <div v-if="loading" class="flex-1 flex flex-col items-center justify-center relative z-10">
      <div class="w-10 h-10 border-4 border-ochre border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-xs font-mono text-parchment/50">Excavating codebase timeline...</p>
    </div>

    <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto relative z-10">
      <AlertTriangle class="text-rust w-12 h-12 mb-4 animate-bounce" />
      <p class="text-sm font-semibold text-parchment/80">{{ error }}</p>
      <p class="text-xs text-parchment/40 mt-2 font-mono uppercase">
        Use Chat Target Extraction to populate decisions
      </p>
    </div>

    <div v-else-if="decisions.length === 0" class="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto relative z-10">
      <Info class="text-parchment/40 w-10 h-10 mb-4" />
      <h3 class="font-display text-sm font-bold text-parchment/80">No decisions extracted yet</h3>
      <p class="text-xs text-parchment/50 mt-2 leading-relaxed font-sans">
        Specify a file path (e.g. <code>src/index.js</code>) on the chat sidebar and click <strong>Extract Decisions</strong> to start archaeology.
      </p>
    </div>

    <!-- Main Workspace Split -->
    <div v-else class="flex-1 flex gap-6 overflow-hidden min-h-0 relative z-10">
      
      <!-- Left Timeline View -->
      <div class="flex-1 overflow-y-auto pr-4 relative scrollbar-thin">
        <div class="absolute left-6 top-2 bottom-2 w-[2px] bg-ochre/15"></div>

        <div class="space-y-6">
          <div 
            v-for="dec in decisions" 
            :key="dec._id"
            @click="selectDecision(dec)"
            class="relative pl-14 cursor-pointer group"
          >
            <!-- Timeline Marker dot -->
            <div 
              class="absolute left-4 top-1.5 w-4 h-4 rounded-full border-2 transition duration-300 flex items-center justify-center"
              :class="[
                selectedDecision?._id === dec._id
                  ? 'bg-ochre border-ochre/75 ring-4 ring-ochre/25 scale-125'
                  : 'bg-soil border-ochre/30 group-hover:border-ochre/60'
              ]"
            >
              <div v-if="dec.staleness?.isStale" class="w-1.5 h-1.5 bg-rust rounded-full"></div>
            </div>

            <!-- Decision Card -->
            <div 
              class="p-4 rounded-xl border transition-all duration-300 hover:translate-x-1"
              :class="[
                selectedDecision?._id === dec._id
                  ? 'bg-surface border-ochre/60 shadow-lg shadow-ochre/5'
                  : 'bg-surface/50 border-ochre/15 hover:border-ochre/35 hover:bg-surface'
              ]"
            >
              <div class="flex items-start justify-between gap-3 mb-2">
                <span class="text-[10px] text-ochre font-bold font-mono tracking-tight bg-soil-dark px-2 py-0.5 rounded border border-ochre/10">
                  {{ dec.filePath.split('/').pop() }}{{ dec.functionName ? ` ➔ ${dec.functionName}()` : '' }}
                </span>
                
                <!-- Staleness Flag -->
                <span 
                  v-if="dec.staleness?.isStale" 
                  class="text-[9px] bg-rust/10 text-rust border border-rust/25 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider"
                >
                  <TrendingDown :size="10" /> Stale
                </span>
                <span 
                  v-else-if="dec.staleness?.checked" 
                  class="text-[9px] bg-teal/10 text-teal border border-teal/25 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider"
                >
                  <CheckCircle :size="10" /> Verified
                </span>
              </div>

              <h4 class="text-xs font-bold text-parchment/90 group-hover:text-ochre transition-colors duration-150 mb-3 line-clamp-2">
                {{ dec.summary }}
              </h4>

              <!-- Footer Metadata -->
              <div class="flex items-center gap-4 text-[9px] font-mono text-parchment/40">
                <span class="flex items-center gap-1">
                  <Calendar :size="11" />
                  {{ formatDate(dec.createdAt) }}
                </span>
                <span v-if="dec.commitSha" class="flex items-center gap-1">
                  <GitCommit :size="11" />
                  {{ dec.commitSha.substring(0, 7) }}
                </span>
                <span v-if="dec.prNumber" class="flex items-center gap-1">
                  <GitPullRequest :size="11" />
                  PR #{{ dec.prNumber }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Detail Sidebar Panel -->
      <div v-if="selectedDecision" class="w-96 border-l border-ochre/10 bg-soil-dark/60 backdrop-blur-md p-5 flex flex-col gap-5 overflow-y-auto shrink-0 min-h-0 scrollbar-thin">
        <div>
          <h3 class="text-[10px] font-mono font-bold text-ochre uppercase tracking-widest mb-2 border-b border-ochre/15 pb-1">
            Unearthed Summary
          </h3>
          <p class="text-xs leading-relaxed text-parchment font-medium">{{ selectedDecision.summary }}</p>
        </div>

        <div class="flex flex-col gap-2 text-[10px] font-mono">
          <span class="text-[10px] font-bold text-ochre uppercase tracking-widest mb-1 border-b border-ochre/15 pb-1 block">
            Context Metadata
          </span>
          <div class="flex justify-between py-1 border-b border-soil/80">
            <span class="text-parchment/40">File Path:</span>
            <span class="text-parchment/80 truncate max-w-[200px]" :title="selectedDecision.filePath">{{ selectedDecision.filePath }}</span>
          </div>
          <div v-if="selectedDecision.functionName" class="flex justify-between py-1 border-b border-soil/80">
            <span class="text-parchment/40">Function:</span>
            <span class="text-parchment/80">{{ selectedDecision.functionName }}</span>
          </div>
          <div v-if="selectedDecision.commitSha" class="flex justify-between py-1 border-b border-soil/80">
            <span class="text-parchment/40">Commit SHA:</span>
            <a 
              :href="`https://github.com/commit/${selectedDecision.commitSha}`"
              target="_blank"
              class="text-ochre hover:text-parchment flex items-center gap-1 font-bold underline decoration-dotted"
            >
              {{ selectedDecision.commitSha.substring(0, 7) }}
            </a>
          </div>
          <div v-if="selectedDecision.prNumber" class="flex justify-between py-1">
            <span class="text-parchment/40">PR Number:</span>
            <a
              :href="`https://github.com/pull/${selectedDecision.prNumber}`"
              target="_blank"
              class="text-ochre hover:text-parchment font-bold underline decoration-dotted"
            >
              #{{ selectedDecision.prNumber }}
            </a>
          </div>
        </div>

        <!-- Verification / Staleness Block -->
        <div class="flex flex-col">
          <h3 class="text-[10px] font-mono font-bold text-ochre uppercase tracking-widest mb-2.5 border-b border-ochre/15 pb-1">
            Staleness Verification
          </h3>
          
          <div 
            v-if="selectedDecision.staleness?.isStale"
            class="p-4 rounded-lg bg-rust/10 border border-rust/20 text-rust shadow-sm"
          >
            <div class="flex items-center gap-2 mb-2 font-bold text-[10px] uppercase tracking-wider">
              <AlertTriangle :size="13" class="text-rust shrink-0" />
              <span>Decayed Premise</span>
            </div>
            <p class="text-xs leading-relaxed text-parchment/90 font-medium">{{ selectedDecision.staleness.reason }}</p>
          </div>

          <div 
            v-else-if="selectedDecision.staleness?.checked"
            class="p-4 rounded-lg bg-teal/10 border border-teal/20 text-teal shadow-sm"
          >
            <div class="flex items-center gap-2 mb-1.5 font-bold text-[10px] uppercase tracking-wider">
              <CheckCircle :size="13" class="text-teal shrink-0" />
              <span>Reasoning Holds</span>
            </div>
            <p class="text-xs leading-relaxed text-parchment/90 font-medium" v-if="selectedDecision.staleness.reason">
              {{ selectedDecision.staleness.reason }}
            </p>
            <p class="text-xs text-parchment/70 font-medium leading-relaxed" v-else>
              LangGraph verification confirms no succeeding modifications have undone this architectural choice.
            </p>
          </div>

          <div 
            v-else
            class="p-4 rounded-lg bg-surface border border-ochre/10 text-parchment/40 text-xs italic"
          >
            Not yet verified for staleness.
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;  
  overflow: hidden;
}
</style>
