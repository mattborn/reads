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

const account = insert()
account.id = 'account'

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
      firebase
        .auth()
        .signOut()
        .then(() => (g('account').textContent = ''))
        .catch(console.error)
    })
  } else {
    const ui = new firebaseui.auth.AuthUI(firebase.auth())
    ui.start('#firebase-ui-auth', {
      signInSuccessUrl: '/',
      signInOptions: [
        firebase.auth.PhoneAuthProvider.PROVIDER_ID,
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
    })

    // don’t do this, yet
    // firebase
    //   .auth()
    //   .signInAnonymously()
    //   .then(() => initRootUser(user))
    //   .catch(console.error)
  }
})

const database = firebase.database()
// const saveData = data => {
//   database
//     .ref('starter')
//     .push(data)
//     .then(() => console.log('Data written to Realtime Database successfully!'))
//     .catch(error => console.error('Error writing data to Realtime Database:', error))
// }

const initRootUser = user => {
  // add or update user profile
  const { displayName, email, emailVerified, isAnonymous, photoURL, phoneNumber, providerData } = user
  const { creationTime, lastSignInTime } = user.metadata
  database
    .ref(`users/${user.uid}`)
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

  initSubsurf(user)
}

const initSubsurf = user => {
  const subsurfRef = database.ref(`subsurf/${user.uid}`)

  subsurfRef
    .once('value')
    .then(snapshot => {
      if (!snapshot.exists()) {
        const firstProject = {
          name: 'untitled',
          basePrompt: '',
          versions: [],
        }

        subsurfRef
          .set([firstProject])
          .then(() => {
            console.log('First project created')
          })
          .catch(console.error)
      } else {
        renderList(snapshot.val())
      }
    })
    .catch(console.error)
}

const renderList = projects => {
  console.log('PROJECTS: ', projects)
}
