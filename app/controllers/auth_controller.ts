import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { registerValidator, loginValidator } from '#validators/auth'

export default class AuthController {
  /**
   * @register
   * @tag authentification
   * @summary Inscription d'un nouvel utilisateur.
   * @requestFormDataBody <registerValidator>
   * @responseBody 422 - {"errors": [{"message": "Le numero de téléphone a déjà été pris","rule": "database.unique","field": "tel"},{"message": "Cet adresse email a déjà été pris","rule": "database.unique","field": "email"},{"message": "Lieu de résidence non valide","rule": "required","field": "lieu_residence.lng"}]}
   * @responseBody 201 - <User>
   */
  async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)

    let emailexist = await User.query().where('email', '=', payload.email).first()

    if (emailexist) {
      return response.conflict({ errors: [{ message: 'Cet adresse email existe déjà !' }] })
    }

    try {
      const user = await User.create(payload)
      if (!user) {
        throw new Error("Une erreur est survenue lors de l'inscription !")
      }

      return response.created(user)
    } catch (error) {
      return response.status(400).json({
        errors: [{ message: error.message }],
      })
    }
  }

  /**
   * @login
   * @tag authentification
   * @summary Connexion de l'utilisateur.
   * @requestFormDataBody <loginValidator>
   * @responseBody 400 - {"errors": [{"message": "Invalide user credential"}]}
   * @responseBody 422 - {"errors": [{"message": "code_tel requis","rule": "required","field": "code_tel"},{"message": "tel requis","rule": "required","field": "tel"},{"message": "Mot de passe requis","rule": "required","field": "password"	}]}
   * @response 200 - Connexion réussie
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)

    if (user.status === 'disable') {
      return response.status(403).json({
        errors: [
          { message: 'Votre compte a été désactivé. Veuillez contacter les administrateurs !' },
        ],
      })
    }
    if (user.deletedAt) {
      return response.status(403).json({ errors: [{ message: 'Compte inexistant !' }] })
    }

    const token = await User.accessTokens.create(user)

    return response.ok({
      token: token,
      ...user.serialize(),
    })
  }

  /**
   * @loginAdmin
   * @tag authentification
   * @summary Connexion des administrateurs au dashboard.
   * @requestFormDataBody <loginValidator>
   * @responseBody 422 - {"errors": [{"message": "veuillez renseigner votre adresse email","rule": "required","field": "email"},{"message": "Mot de passe requis","rule": "required","field": "password"	}]}
   * @responseBody 403 - {"errors": [{"message": "Accès interdit : vous n'êtes pas autorisé à accéder à cette section.","rule": "only admin"}]}
   * @responseBody 201 - Connexion réussie
   */
  /* async loginAdmin({ request, response }: HttpContext) {
    const { code_tel, tel, password } = await request.validateUsing(loginValidator)

    // Vérification des informations d'identification de l'utilisateur
    const admin = await User.verifyCredentials(tel, password)
    if (admin.code_tel != code_tel) {
      return response.status(404).json({ errors: [{ message: 'Identifiants invalide !' }] })
    }
    // Vérification du rôle ou des permissions
    if (admin.admin !== true) {
      return response.forbidden({
        message: "Accès interdit : vous n'êtes pas autorisé à accéder à cette section.",
      })
    }

    if (admin.statut === 'disable') {
      return response.forbidden({
        errors: [
          { message: 'Votre compte a été désactivé. Veuillez contacter les administrateurs !' },
        ],
      })
    }
    if (admin.deleted_at) {
      return response.forbidden({ errors: [{ message: 'Compte inexistant !' }] })
    }

    await admin.load('permission')

    // Génération du token d'accès
    const token = await User.accessTokens.create(admin)

    return response.ok({
      token: token,
      ...admin.serialize(),
    })
  } */

  /**
   * @logout
   * @tag authentification
   * @summary Déconnexion de l'utilisateur.
   * @description Déconnexion de l'utilisateur.
   * @requestBody {"foo": "bar"} // Expects a specific JSON
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const token = auth.user?.currentAccessToken.identifier
    if (!token) {
      return response.status(401).json({ errors: [{ message: 'Token not found' }] })
    }
    await User.accessTokens.delete(user, token)
    return response.ok({ message: 'Logged out' })
  }
}
