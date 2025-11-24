// Configura Amplify con la exportación generada por la CLI
Amplify.configure(window.amplifyConfig);

// Define las operaciones GraphQL
const createMessageMutation = `
  mutation CreateMessage($content: String!) {
    createMessage(input: {content: $content}) {
      id
      content
      createdAt
      owner
    }
  }
`;

const deleteMessageMutation = `
  mutation DeleteMessage($id: ID!) {
    deleteMessage(input: {id: $id}) {
      id
    }
  }
`;

const listMessagesQuery = `
  query ListMessages {
    listMessages {
      items {
        id
        content
        createdAt
        owner
      }
    }
  }
`;

let currentAuthenticatedUser = null;

// --- Funciones de Autenticación ---

async function checkUser() {
    try {
        currentAuthenticatedUser = await Amplify.Auth.currentAuthenticatedUser();
        document.getElementById('auth-ui').style.display = 'none';
        document.getElementById('guestbook-ui').style.display = 'block';
        document.getElementById('app-status').innerText = `Autenticado como: ${currentAuthenticatedUser.attributes.phone_number}`;
        await fetchMessages();
    } catch (e) {
        document.getElementById('auth-ui').style.display = 'block';
        document.getElementById('guestbook-ui').style.display = 'none';
        document.getElementById('app-status').innerText = 'Por favor, regístrate o inicia sesión.';
    }
}

async function register() {
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    try {
        await Amplify.Auth.signUp({
            username: phone,
            password: password,
            attributes: { phone_number: phone }
        });
        alert('Registro exitoso. Revisa tu SMS para el código de verificación.');
        document.getElementById('register-login').style.display = 'none';
        document.getElementById('verify-code').style.display = 'block';
    } catch (error) {
        alert(`Error en el registro: ${error.message}`);
    }
}

async function confirmSignUp() {
    const phone = document.getElementById('phone').value;
    const code = document.getElementById('verification-code').value;
    try {
        await Amplify.Auth.confirmSignUp(phone, code);
        alert('Cuenta confirmada. Por favor, inicia sesión.');
        document.getElementById('verify-code').style.display = 'none';
        document.getElementById('register-login').style.display = 'block';
    } catch (error) {
        alert(`Error al confirmar: ${error.message}`);
    }
}

async function login() {
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    try {
        await Amplify.Auth.signIn(phone, password);
        await checkUser(); // Verificar y cargar el guestbook
    } catch (error) {
        alert(`Error al iniciar sesión: ${error.message}`);
        if (error.code === 'UserNotConfirmedException') {
             // Si el usuario no confirmó, lo enviamos a verificar
             document.getElementById('register-login').style.display = 'none';
             document.getElementById('verify-code').style.display = 'block';
        }
    }
}

async function logout() {
    try {
        await Amplify.Auth.signOut();
        alert('Sesión cerrada.');
        currentAuthenticatedUser = null;
        checkUser(); // Volver a la UI de autenticación
    } catch (error) {
        console.error('Error al cerrar sesión', error);
    }
}


// --- Funciones de Guestbook ---

async function postMessage() {
    const content = document.getElementById('message-content').value;
    if (!content) {
        alert('El mensaje no puede estar vacío.');
        return;
    }

    try {
        await Amplify.API.graphql({
            query: createMessageMutation,
            variables: { content }
        });
        document.getElementById('message-content').value = '';
        await fetchMessages(); // Recargar la lista
    } catch (error) {
        alert('Error al publicar el mensaje.');
        console.error('Error GraphQL:', error);
    }
}

async function deleteMessage(id) {
    if (!confirm('¿Estás seguro de que quieres borrar este mensaje?')) return;

    try {
        await Amplify.API.graphql({
            query: deleteMessageMutation,
            variables: { id }
        });
        await fetchMessages(); // Recargar la lista
    } catch (error) {
        alert('Error al borrar el mensaje. (Solo puedes borrar tus propias publicaciones)');
        console.error('Error GraphQL:', error);
    }
}

async function fetchMessages() {
    try {
        const response = await Amplify.API.graphql({ query: listMessagesQuery });
        const messages = response.data.listMessages.items;
        const userMessagesContainer = document.getElementById('user-messages');
        userMessagesContainer.innerHTML = '';
        
        const currentUserId = currentAuthenticatedUser.attributes.sub; // ID único del usuario (sub)

        messages
            .filter(msg => msg.owner === currentUserId) // Filtramos solo los mensajes de este usuario
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Ordenar por fecha
            .forEach(message => {
                const messageEl = document.createElement('div');
                messageEl.className = 'message-item';
                messageEl.innerHTML = `
                    <span>
                        <span class="owner-tag">Tú:</span>
                        ${message.content} 
                        <small>(${new Date(message.createdAt).toLocaleTimeString()})</small>
                    </span>
                    <button onclick="deleteMessage('${message.id}')">Eliminar</button>
                `;
                userMessagesContainer.appendChild(messageEl);
            });

    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        document.getElementById('user-messages').innerHTML = '<p>Error al cargar los mensajes.</p>';
    }
}

// Iniciar la verificación de usuario al cargar la página
checkUser();
