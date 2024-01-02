import { execSync } from 'child_process'

const message = process.argv[2]
const branchName = message.toLowerCase().split(' ').join('-')

execSync(`git checkout -b ${branchName}`)
execSync('git add .')
execSync(`git commit -m "${message}"`)
execSync(`git push origin ${branchName}`)
