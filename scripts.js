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

const insert = (target = document.body, tag = 'div') => {
  const el = document.createElement(tag)
  target.appendChild(el)
  return el
}

firebase.auth().onAuthStateChanged(user => {
  if (user) {
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
      signInOptions: [
        firebase.auth.PhoneAuthProvider.PROVIDER_ID,
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
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

  userRef.child('apps').update({ subsurf: true })

  initSubsurf(user)
}

const initSubsurf = user => {
  database.ref(`subsurf/${user.uid}`).on('value', snapshot => {
    const versions = snapshot.val() || []
    g('list').innerHTML = '' // clear list
    // console.log(Object.values(versions))
    Object.values(versions)
      .sort((a, b) => b.created - a.created)
      .forEach((v, i) => {
        const business_name = v.business_name || 'Untitled'

        const version = insert(g('list'))
        version.className = 'version'
        const version_name = insert(version)
        version_name.className = 'version-name'
        version_name.textContent = `${business_name} ${v.version}`
        version.addEventListener('click', e => {
          // highlight active
          q('.version').forEach(el => el.classList.remove('active'))
          version.classList.add('active')
          // hydrate form
          g('business_name').value = business_name
          g('business_name').dispatchEvent(new Event('input', { bubbles: true }))
          g('base_prompt').value = v.base_prompt
          g('base_prompt').dispatchEvent(new Event('input', { bubbles: true }))
          // hydrate preview
          g('headline').textContent = v.headline
          g('lede').textContent = v.lede
          if (v.image) g('image').src = v.image

          setCSS(`#preview { color: ${v.color}; }
          button, .badge, #footer { background: ${v.color}; }`)

          g('services').innerHTML = ''
          v.services.split(',').forEach(s => {
            const li = insert(g('services'), 'li')
            li.textContent = s
          })
          g('services_h2').textContent = v.services_h2
        })
        if (!i) version.click()
      })
  })

  renderGenerateButton(user)
}

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
