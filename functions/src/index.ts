import * as functions from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import * as crypto from 'crypto'
import base64url from 'base64url'

initializeApp()
const db = getFirestore()

export const keyGen = functions.https.onRequest(async (request, response) => {
    const numKeys = 100
    const keyLength = 6

    let keys = []

    for (let i = 0; i < numKeys; i++) {
        let key = base64url(crypto.randomBytes(keyLength)).slice(0, 6)
        keys.push(key)
    }

    const keyRef = db.collection('keys').doc('keys')
    await keyRef.set({
        usedKeys: [],
        unusedKeys: keys,
    })

    response.send(keys.toString())
})

export const urlEncode = functions.https.onRequest(async (request, response) => {
    functions.logger.info(request.query['url'], { structuredData: true })
    const keyRef = await db.collection('keys').doc('keys').get()

    let unusedKeys: string[] = keyRef.get('unusedKeys')
    let usedKeys: string[] = keyRef.get('usedKeys')

    let topKey = unusedKeys.pop()
    if (topKey === undefined) {
        response.sendStatus(401)
        return
    }

    usedKeys.push(topKey)

    await db.collection('keys').doc('keys').update({
        usedKeys: usedKeys,
        unusedKeys: unusedKeys,
    })

    const docRef = db.collection('links').doc(topKey)
    await docRef.set({
        url: request.query['url'],
    })

    response.send(`Key for ${request.query['url']}: ${topKey}`)
})

export const urlDecode = functions.https.onRequest(async (request, response) => {
    functions.logger.info(`Decoding: ${request.params[0].slice(1)}`, { struturedData: true })
    console.log(request.params[0].slice(1))
    const snapshot = await db.collection('links').doc(request.params[0].slice(1)).get()
    if (!snapshot.exists) {
        response.sendStatus(401)
        return
    }

    let redirectUrl = snapshot.get('url')

    functions.logger.info(`Resolved to: ${redirectUrl}`, { struturedData: true })

    response.redirect(redirectUrl)
})
