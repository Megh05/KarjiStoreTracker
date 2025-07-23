import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, Bot, Database, Upload, RefreshCw, ExternalLink, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AiConfig {
  id: number;
  provider: 'azure' | 'ollama';
  config: any;
  customInstructions?: string;
  isActive: boolean;
}

interface KnowledgeBase {
  id: number;
  title: string;
  content: string;
  type: string;
  sourceUrl?: string;
  isActive: boolean;
  createdOnUtc: string;
}

interface MerchantFeed {
  id: number;
  name: string;
  feedUrl: string;
  isActive: boolean;
  lastSyncedAt?: string;
  syncInterval: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<'azure' | 'ollama'>('azure');
  const [customInstructions, setCustomInstructions] = useState('');

  // AI Configuration Form States
  const [azureConfig, setAzureConfig] = useState({
    endpoint: '',
    apiKey: '',
    deploymentName: '',
    apiVersion: '2024-02-01'
  });

  const [ollamaConfig, setOllamaConfig] = useState({
    endpoint: 'http://localhost:11434',
    model: ''
  });

  // Knowledge Base Form States
  const [newKnowledge, setNewKnowledge] = useState({
    title: '',
    content: '',
    type: 'faq',
    sourceUrl: ''
  });

  // Merchant Feed Form States
  const [newFeed, setNewFeed] = useState({
    name: '',
    feedUrl: '',
    syncInterval: 10800 // 3 hours
  });

  // Query for current AI configuration
  const { data: aiConfig = null } = useQuery({
    queryKey: ['/api/admin/ai-config'],
    queryFn: () => apiRequest('/api/admin/ai-config')
  });

  // Query for Ollama models
  const { data: ollamaModels = [], refetch: refetchModels } = useQuery({
    queryKey: ['/api/admin/ollama-models'],
    queryFn: () => apiRequest('/api/admin/ollama-models'),
    enabled: selectedProvider === 'ollama'
  });

  // Query for knowledge base
  const { data: knowledgeBase = [] } = useQuery({
    queryKey: ['/api/admin/knowledge-base'],
    queryFn: () => apiRequest('/api/admin/knowledge-base')
  });

  // Query for merchant feeds
  const { data: merchantFeeds = [] } = useQuery({
    queryKey: ['/api/admin/merchant-feeds'],
    queryFn: () => apiRequest('/api/admin/merchant-feeds')
  });

  // Mutations
  const saveAiConfigMutation = useMutation({
    mutationFn: (config: any) => apiRequest('/api/admin/ai-config', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
    onSuccess: () => {
      toast({ title: "AI Configuration saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save AI configuration",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: (config: any) => apiRequest('/api/admin/test-connection', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
    onSuccess: () => {
      toast({ title: "Connection test successful!" });
    },
    onError: (error: any) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const addKnowledgeMutation = useMutation({
    mutationFn: (knowledge: any) => apiRequest('/api/admin/knowledge-base', {
      method: 'POST',
      body: JSON.stringify(knowledge)
    }),
    onSuccess: () => {
      toast({ title: "Knowledge added successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/knowledge-base'] });
      setNewKnowledge({ title: '', content: '', type: 'faq', sourceUrl: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add knowledge",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const addMerchantFeedMutation = useMutation({
    mutationFn: (feed: any) => apiRequest('/api/admin/merchant-feeds', {
      method: 'POST',
      body: JSON.stringify(feed)
    }),
    onSuccess: () => {
      toast({ title: "Merchant feed added successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/merchant-feeds'] });
      setNewFeed({ name: '', feedUrl: '', syncInterval: 10800 });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add merchant feed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const syncFeedsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/sync-feeds', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: "Merchant feeds sync started!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/merchant-feeds'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to sync feeds",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Load current config
  useEffect(() => {
    if (aiConfig) {
      setSelectedProvider(aiConfig.provider || 'azure');
      setCustomInstructions(aiConfig.customInstructions || '');
      
      if (aiConfig.provider === 'azure' && aiConfig.config) {
        setAzureConfig(aiConfig.config);
      } else if (aiConfig.provider === 'ollama' && aiConfig.config) {
        setOllamaConfig(aiConfig.config);
      }
    }
  }, [aiConfig]);

  const handleSaveAiConfig = () => {
    const config = {
      provider: selectedProvider,
      config: selectedProvider === 'azure' ? azureConfig : ollamaConfig,
      customInstructions
    };
    saveAiConfigMutation.mutate(config);
  };

  const handleTestConnection = () => {
    const config = {
      provider: selectedProvider,
      config: selectedProvider === 'azure' ? azureConfig : ollamaConfig
    };
    testConnectionMutation.mutate(config);
  };

  const handleRefreshModels = () => {
    refetchModels();
    toast({ title: "Refreshing available models..." });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Configure your AI chatbot and manage knowledge base</p>
        </div>

        <Tabs defaultValue="ai-config" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai-config" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Configuration
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Knowledge Base
            </TabsTrigger>
            <TabsTrigger value="feeds" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Merchant Feeds
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* AI Configuration Tab */}
          <TabsContent value="ai-config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI Provider Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="provider">AI Provider</Label>
                    <Select value={selectedProvider} onValueChange={(value: 'azure' | 'ollama') => setSelectedProvider(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select AI Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="azure">Azure OpenAI</SelectItem>
                        <SelectItem value="ollama">Ollama (Local)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProvider === 'azure' && (
                    <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                      <h3 className="font-semibold text-blue-900">Azure OpenAI Configuration</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="azure-endpoint">Endpoint URL</Label>
                          <Input
                            id="azure-endpoint"
                            placeholder="https://your-resource.openai.azure.com"
                            value={azureConfig.endpoint}
                            onChange={(e) => setAzureConfig({ ...azureConfig, endpoint: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="azure-key">API Key</Label>
                          <Input
                            id="azure-key"
                            type="password"
                            placeholder="Your Azure OpenAI API key"
                            value={azureConfig.apiKey}
                            onChange={(e) => setAzureConfig({ ...azureConfig, apiKey: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="azure-deployment">Deployment Name</Label>
                          <Input
                            id="azure-deployment"
                            placeholder="your-deployment-name"
                            value={azureConfig.deploymentName}
                            onChange={(e) => setAzureConfig({ ...azureConfig, deploymentName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="azure-version">API Version</Label>
                          <Input
                            id="azure-version"
                            placeholder="2024-02-01"
                            value={azureConfig.apiVersion}
                            onChange={(e) => setAzureConfig({ ...azureConfig, apiVersion: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedProvider === 'ollama' && (
                    <div className="space-y-4 p-4 border rounded-lg bg-green-50">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-green-900">Ollama Configuration</h3>
                        <Button variant="outline" size="sm" onClick={handleRefreshModels}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh Models
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ollama-endpoint">Ollama Endpoint</Label>
                          <Input
                            id="ollama-endpoint"
                            placeholder="http://localhost:11434"
                            value={ollamaConfig.endpoint}
                            onChange={(e) => setOllamaConfig({ ...ollamaConfig, endpoint: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="ollama-model">Model</Label>
                          <Select value={ollamaConfig.model} onValueChange={(value) => setOllamaConfig({ ...ollamaConfig, model: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.isArray(ollamaModels) && ollamaModels.length > 0 ? (
                                ollamaModels.map((model: any) => (
                                  <SelectItem key={model.name} value={model.name}>
                                    {model.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-models" disabled>No models available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="custom-instructions">Custom Instructions</Label>
                    <Textarea
                      id="custom-instructions"
                      placeholder="Enter custom instructions for the AI assistant..."
                      rows={4}
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveAiConfig} disabled={saveAiConfigMutation.isPending}>
                      {saveAiConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    <Button variant="outline" onClick={handleTestConnection} disabled={testConnectionMutation.isPending}>
                      {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Knowledge Base Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-semibold">Add New Knowledge</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="knowledge-title">Title</Label>
                      <Input
                        id="knowledge-title"
                        placeholder="Knowledge title"
                        value={newKnowledge.title}
                        onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="knowledge-type">Type</Label>
                      <Select value={newKnowledge.type} onValueChange={(value) => setNewKnowledge({ ...newKnowledge, type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="faq">FAQ</SelectItem>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="pdf">PDF Document</SelectItem>
                          <SelectItem value="manual">Manual Entry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="knowledge-source">Source URL (optional)</Label>
                    <Input
                      id="knowledge-source"
                      placeholder="https://example.com/source"
                      value={newKnowledge.sourceUrl}
                      onChange={(e) => setNewKnowledge({ ...newKnowledge, sourceUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="knowledge-content">Content</Label>
                    <Textarea
                      id="knowledge-content"
                      placeholder="Enter the knowledge content..."
                      rows={4}
                      value={newKnowledge.content}
                      onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                    />
                  </div>
                  <Button 
                    onClick={() => addKnowledgeMutation.mutate(newKnowledge)}
                    disabled={addKnowledgeMutation.isPending || !newKnowledge.title || !newKnowledge.content}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {addKnowledgeMutation.isPending ? 'Adding...' : 'Add Knowledge'}
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Existing Knowledge Base</h3>
                  {Array.isArray(knowledgeBase) && knowledgeBase.length > 0 ? (
                    <div className="grid gap-4">
                      {knowledgeBase.map((item: KnowledgeBase) => (
                        <Card key={item.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{item.title}</h4>
                                <Badge variant="outline">{item.type}</Badge>
                                {item.isActive && <Badge variant="default">Active</Badge>}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{item.content.substring(0, 200)}...</p>
                              {item.sourceUrl && (
                                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" 
                                   className="text-sm text-blue-600 hover:underline">
                                  View Source
                                </a>
                              )}
                            </div>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No knowledge base entries found. Add some knowledge to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Merchant Feeds Tab */}
          <TabsContent value="feeds" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  Merchant Feed Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-semibold">Add New Merchant Feed</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="feed-name">Feed Name</Label>
                      <Input
                        id="feed-name"
                        placeholder="Google Merchant Feed"
                        value={newFeed.name}
                        onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="feed-url">Feed URL</Label>
                      <Input
                        id="feed-url"
                        placeholder="https://example.com/feed.xml"
                        value={newFeed.feedUrl}
                        onChange={(e) => setNewFeed({ ...newFeed, feedUrl: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sync-interval">Sync Interval (seconds)</Label>
                    <Input
                      id="sync-interval"
                      type="number"
                      placeholder="10800 (3 hours)"
                      value={newFeed.syncInterval}
                      onChange={(e) => setNewFeed({ ...newFeed, syncInterval: parseInt(e.target.value) || 10800 })}
                    />
                  </div>
                  <Button 
                    onClick={() => addMerchantFeedMutation.mutate(newFeed)}
                    disabled={addMerchantFeedMutation.isPending || !newFeed.name || !newFeed.feedUrl}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {addMerchantFeedMutation.isPending ? 'Adding...' : 'Add Feed'}
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Active Merchant Feeds</h3>
                    <Button 
                      onClick={() => syncFeedsMutation.mutate()}
                      disabled={syncFeedsMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {syncFeedsMutation.isPending ? 'Syncing...' : 'Sync All Feeds'}
                    </Button>
                  </div>
                  
                  {Array.isArray(merchantFeeds) && merchantFeeds.length > 0 ? (
                    <div className="grid gap-4">
                      {merchantFeeds.map((feed: MerchantFeed) => (
                        <Card key={feed.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{feed.name}</h4>
                                {feed.isActive && <Badge variant="default">Active</Badge>}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">URL: {feed.feedUrl}</p>
                              <p className="text-sm text-gray-600 mb-1">Sync Interval: {feed.syncInterval / 3600} hours</p>
                              {feed.lastSyncedAt && (
                                <p className="text-sm text-gray-500">Last synced: {new Date(feed.lastSyncedAt).toLocaleString()}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No merchant feeds configured. Add a feed to start syncing product data.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{Array.isArray(knowledgeBase) ? knowledgeBase.length : 0}</div>
                    <div className="text-sm text-gray-600">Knowledge Entries</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{Array.isArray(merchantFeeds) ? merchantFeeds.length : 0}</div>
                    <div className="text-sm text-gray-600">Merchant Feeds</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{aiConfig ? 1 : 0}</div>
                    <div className="text-sm text-gray-600">AI Providers</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">-</div>
                    <div className="text-sm text-gray-600">Total Chats</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}