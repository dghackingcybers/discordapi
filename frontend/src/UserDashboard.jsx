import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

function UserDashboard() {
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);
    setUserData(null);
    try {
      const res = await fetch(`/userFullInfo?id=${userId}`);
      if (!res.ok) throw new Error('Erro na requisição');
      const data = await res.json();
      setUserData(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Input
        placeholder="Digite o ID do usuário"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <Button onClick={fetchUserData} disabled={loading || !userId}>
        Buscar
      </Button>

      {loading && <p>Carregando...</p>}
      {error && <p className="text-red-500">Erro: {error}</p>}

      {userData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="space-y-2">
              <p><strong>ID:</strong> {userData.id}</p>
              <p><strong>Usuário:</strong> {userData.username}</p>
              <p><strong>Email:</strong> {userData.email}</p>
              <p><strong>Plano:</strong> {userData.plan}</p>
              <p><strong>Último Login:</strong> {userData.lastLogin}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default UserDashboard;
