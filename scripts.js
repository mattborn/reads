const g = document.getElementById.bind(document)
const q = document.querySelectorAll.bind(document)

const app = firebase.initializeApp({
  apiKey: 'AIzaSyBTDD3ZuBRNUtchdG3OfIJnm3SCf4hneQ8',
  authDomain: 'mattborn.firebaseapp.com',
  databaseURL: 'https://mattborn.firebaseio.com',
  projectId: 'project-8793044166487435911',
  storageBucket: 'project-8793044166487435911.appspot.com',
  messagingSenderId: '915826759190',
  appId: '1:915826759190:web:9028f607150a3f3a79c737',
})
// Firebase Analytics is automatically initialized

// init

dayjs.extend(dayjs_plugin_isoWeek)
dayjs.extend(dayjs_plugin_isLeapYear)

const generateWeeks = year => {
  const weeks = {}
  const thisWeek = dayjs().isoWeek()
  Array.from({ length: dayjs(`${year}-12-31`).isoWeek() }, (_, i) => {
    i = i + 1
    const week = year.toString().slice(-2) + String(i).padStart(2, '0')
    weeks[week] = {
      test: dayjs().year(year).isoWeek(i).endOf('isoWeek').format('YYYY-MM-DD'),
      when: i < thisWeek ? 'past' : i === thisWeek ? 'present' : 'future',
    }
  })
  return weeks
}

// utilities

const insert = (target = document.body, tag = 'div') => {
  const el = document.createElement(tag)
  target.appendChild(el)
  return el
}

// auth

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // clear auth DOM elements
    g('firebase-ui-auth').innerHTML = ''
    document.body.classList.remove('hide-app')

    if (user.isAnonymous) {
      g('account-name').textContent = 'Anonymous'
      g('account-id').textContent = user.uid
    } else {
      g('account-name').textContent = user.displayName
      g('account-id').textContent = user.email ? user.email : user.uid

      if (user.photoURL) {
        q('#account img')[0].src = user.photoURL
      }
    }
    initRootUser(user)

    const signOut = insert(g('account'), 'button')
    signOut.textContent = 'Sign out'
    signOut.addEventListener('click', e => {
      firebase.auth().signOut().catch(console.error)
    })
  } else {
    document.body.classList.add('hide-app')
    const ui = new firebaseui.auth.AuthUI(firebase.auth())
    ui.start('#firebase-ui-auth', {
      signInSuccessUrl: '/',
      signInOptions: [firebase.auth.GoogleAuthProvider.PROVIDER_ID],
    })

    const anonButton = insert(g('firebase-ui-auth'), 'button')
    anonButton.textContent = 'Continue anonymously'
    anonButton.addEventListener('click', e => {
      firebase.auth().signInAnonymously().catch(console.error)
    })
  }
})

const database = firebase.database()

const initRootUser = user => {
  // console.log('initRootUser', user)
  // add or update user profile
  const { displayName, email, emailVerified, isAnonymous, photoURL, phoneNumber, providerData } = user
  const { creationTime, lastSignInTime } = user.metadata
  const userRef = database.ref(`users/${user.uid}`)
  userRef
    .update({
      creationTime,
      displayName,
      email,
      emailVerified,
      isAnonymous,
      lastSignInTime,
      phoneNumber,
      photoURL,
      providerData,
    })
    .catch(console.error)

  userRef.child('apps').update({ reads: true }).catch(console.error) // auto provision

  initApp(user)
}

const initApp = user => {
  // scaffold weeks if user has none OR update past/present/future every time
  const weeks = generateWeeks(dayjs().year())
  database.ref(`reads/${user.uid}`).update(weeks).catch(console.error)

  database.ref(`reads/${user.uid}`).on('value', snapshot => {
    const list = snapshot.val() || []
    g('weeks').innerHTML = '' // clear list
    const keys = Object.keys(list)
    for (const item in list) {
      const w = list[item]

      // hydrate list
      const row = insert(g('weeks'), 'tr')
      row.className = w.when

      const id = insert(row, 'td')
      id.textContent = item

      const book = insert(row, 'td')
      book.textContent = 'title, author'

      const medium = insert(row, 'td')
      medium.textContent = 'physical, audible, internet, chatgpt'

      const method = insert(row, 'td')
      method.textContent = 'speed read, 2 hours, hack?'

      const status = insert(row, 'td')
      status.textContent = 'active?'

      const review = insert(row, 'td')
      review.textContent = 'url?'

      if (keys.indexOf(item) === keys.length - 1) {
        q('.present td')[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    // .sort((a, b) => b.created - a.created)
    // version.addEventListener('click', e => {
    // highlight active
    // q('.version').forEach(el => el.classList.remove('active'))
    // version.classList.add('active')
    // hydrate form
    // })
  })
  // renderGenerateButton(user)
}
/* HOLD
// depends on user object
const renderGenerateButton = user => {
  const generateButton = insert(g('actions'), 'button')
  generateButton.textContent = 'Generate'
  generateButton.addEventListener('click', e => {
    const business_name = g('business_name').value
    const base_prompt = g('base_prompt').value
    generateButton.disabled = true
    document.body.classList.add('loading')

    const userRef = database.ref(`subsurf/${user.uid}`)
    // get next version number
    let version = 1
    userRef
      .orderByChild('business_name')
      .equalTo(business_name)
      .limitToLast(1)
      .once('value')
      .then(snapshot => {
        snapshot.forEach(child => {
          const match = child.val()
          version = (match.version || 0) + 1
        })
      })

    try {
      turbo([
        {
          role: 'system',
          content: `Generate content for a website about ${base_prompt}`,
        },
        {
          role: 'user',
          content: `Return a single JSON object copying this schema: ${JSON.stringify({
            color: 'hex value for trendy, relevant light brand color',
            dalle_prompt: 'prompt for DALL-E to generate a relevant image that includes "minimalist spot illustration"',
            headline: 'clever, pithy headline to be displayed in large bold type at top of home page',
            lede: ' lede immediately after headline',
            services: 'a comma-delimited list of 12 relevant services',
            services_h2: 'repeat three services each as one word as a list ending with and more',
          })} and use the values as hints.`,
        },
      ]).then(text => {
        const json = toJSON(text)
        const { color, dalle_prompt, headline, lede, services, services_h2 } = json
        const versionRef = userRef.push({
          base_prompt,
          business_name,
          color,
          created: Date.now(),
          headline,
          lede,
          services,
          services_h2,
          version,
        })
        image(dalle_prompt).then(text => versionRef.update({ image: text }))
        generateButton.disabled = false
        document.body.classList.remove('loading')
      })
    } catch (error) {
      console.error(error)
    }
  })
}

// manage

const turbo = async messages => {
  // console.log('Fetching data…', messages)
  const response = await fetch(`https://us-central1-samantha-374622.cloudfunctions.net/turbo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  })
  return response.text()
}

const toJSON = str => {
  const curly = str.indexOf('{')
  const square = str.indexOf('[')
  let first
  if (curly < 0) first = '[' // only for empty arrays
  else if (square < 0) first = '{'
  else first = curly < square ? '{' : '['
  const last = first === '{' ? '}' : ']'
  // ensure JSON is complete
  let count = 0
  for (const c of str) {
    if (c === '{' || c === '[') count++
    else if (c === '}' || c === ']') count--
  }
  if (!count) return JSON.parse(str.slice(str.indexOf(first), str.lastIndexOf(last) + 1))
}

const image = async prompt => {
  // console.log('Fetching image…', prompt)
  const response = await fetch(`https://us-central1-samantha-374622.cloudfunctions.net/dalle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })
  return response.text()
}

// temporary client-side DOM edits, needs SSR

g('business_name').addEventListener('input', e => {
  q('section .brand').forEach(el => (el.textContent = e.currentTarget.value))
})

const style = insert(document.head, 'style')
const setCSS = css => (style.innerHTML = css)

END HOLD */
