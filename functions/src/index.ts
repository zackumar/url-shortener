import { customAlphabet } from 'nanoid'
import { initializeApp } from 'firebase-admin'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

initializeApp()
const db = admin.firestore()

const numKeys = 100
const keyLength = 6
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const nanoid = customAlphabet(alphabet, keyLength)

export const keyGen = functions.https.onRequest(async (request, response) => {
    let keys: string[] = []

    for (let i = 0; i < numKeys; i++) {
        let key = nanoid()
        if (keys.includes(key)) {
            i -= 1
            continue
        }
        keys.push(key)
    }

    const keyRef = db.collection('keys').doc('keys')
    await keyRef.set({
        usedKeys: [],
        unusedKeys: keys,
    })

    response.send(keys.toString())
})

export const urlEncode = functions.https.onCall(async (data, context) => {
    functions.logger.info(data, { structuredData: true })
    const keyRef = await db.collection('keys').doc('keys').get()

    let usedKeys: string[] = keyRef.get('usedKeys') || []

    if ('alias' in data) {
        let alias = data['alias']

        if (usedKeys.includes(alias)) {
            return {
                status: 'error',
                error: 'Alias already in use.',
            }
        }

        usedKeys.push(alias)

        await db.collection('keys').doc('keys').update({
            usedKeys: usedKeys,
        })

        const docRef = db.collection('links').doc(alias)
        await docRef.set({
            url: data['url'],
        })

        return {
            status: 'ok',
            alias: alias,
        }
    }

    let unusedKeys: string[] = keyRef.get('unusedKeys') || []

    let topKey = unusedKeys.pop()
    if (topKey === undefined) {
        return {
            status: 'error',
            error: 'No unused keys',
        }
    }

    usedKeys.push(topKey)

    await db.collection('keys').doc('keys').update({
        usedKeys: usedKeys,
        unusedKeys: unusedKeys,
    })

    const docRef = db.collection('links').doc(topKey)
    await docRef.set({
        url: data['url'],
    })

    return {
        status: 'ok',
        alias: topKey,
    }
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
