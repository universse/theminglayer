import { execSync } from 'child_process'

const commitMessage = process.argv[2]

execSync('git add .')
execSync(`git commit -m "${commitMessage}"`)
execSync('git push -f')
// execSync('git push -f origin main')
