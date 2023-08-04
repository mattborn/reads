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

const formatYearWeek = (year, week) => {
  return String(year).slice(-2) + String(week).padStart(2, '0')
}

const currentWeek = formatYearWeek(dayjs().year(), dayjs().isoWeek())

const generateWeeks = year => {
  const weeks = {}
  const thisWeek = dayjs().isoWeek()
  Array.from({ length: dayjs(`${year}-12-31`).isoWeek() }, (_, i) => {
    i = i + 1
    const week = formatYearWeek(year, i)
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
  const ref = database.ref(`reads/${user.uid}`)
  ref.on('value', snapshot => {
    const list = snapshot.val()

    if (!list) {
      // scaffold weeks if user has none
      const weeks = generateWeeks(dayjs().year())
      ref.update(weeks).catch(console.error)
    } else {
      // OR update only past/present/future
      const updates = {}
      for (const [week, details] of Object.entries(weeks)) {
        if (list[week]) {
          updates[`${week}/when`] = details.when
        }
      }
      if (Object.keys(updates).length > 0) {
        ref.update(updates).catch(console.error)
      }
    }

    g('weeks').innerHTML = '' // clear list
    const keys = Object.keys(list)
    for (const item in list) {
      const w = list[item]

      // hydrate list
      const row = insert(g('weeks'), 'tr')
      row.className = w.when

      const id = insert(row, 'td')
      id.textContent = item
      if (w.when === 'present') {
        const outline = insert(id)
        outline.id = 'outline'
      }

      const book = insert(row, 'td')
      const title = insert(book)
      title.textContent = w.title || ''
      const author = insert(book)
      author.textContent = w.author || ''

      const medium = insert(row, 'td')
      medium.textContent = w.medium || '' //'physical, audible, internet, chatgpt'

      const method = insert(row, 'td')
      method.textContent = w.method || '' //'speed read, 2 hours, hack?'

      const status = insert(row, 'td')
      status.textContent = w.status || ''

      const notes = insert(row, 'td')
      notes.textContent = w.notes || ''

      if (keys.indexOf(item) === keys.length - 1) {
        setOutlineWidth()
        showThisWeek()
      }
    }

    // init form
    let defaultWeek = currentWeek
    database.ref(`reads/${user.uid}/${currentWeek}`).once('value', snapshot => {
      if (snapshot.exists() && snapshot.val().title) {
        defaultWeek++
      }
      g('week').value = defaultWeek
    })

    // bind save
    g('save').addEventListener('click', e => {
      const week = g('week').value
      const title = g('title').value
      const author = g('author').value
      const physical = g('physical').checked
      const parts = g('parts').value
      const notes = g('parts').value

      database.ref(`reads/${user.uid}/${week}`).update({
        author,
        notes,
        parts,
        physical,
        title,
      })
    })
    // .sort((a, b) => b.created - a.created)
    // version.addEventListener('click', e => {
    // highlight active
    // q('.version').forEach(el => el.classList.remove('active'))
    // version.classList.add('active')
    // hydrate form
    // })
  })
}

const showThisWeek = () => {
  q('.present td')[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/* hacks */

const setOutlineWidth = () => {
  g('outline').style.width = `${g('list').offsetWidth}px`
}

const debounce = (func, wait) => {
  let timeout
  return function () {
    const context = this
    const args = arguments
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(context, args), wait)
  }
}

window.addEventListener('resize', debounce(setOutlineWidth, 500))

g('jump').addEventListener('click', e => showThisWeek())
